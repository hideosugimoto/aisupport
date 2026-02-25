import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLLMClient } from "@/lib/llm/client-factory";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { OgpFetcher } from "@/lib/feed/ogp-fetcher";
import { KeywordTranslator } from "@/lib/feed/keyword-translator";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";
import type { FeedArticleData } from "@/lib/feed/types";

const logger = createLogger("api:feed-refresh");

export async function POST() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json({ error: "フィード機能はProプランで利用できます" }, { status: 403 });
    }

    const keywords = await prisma.feedKeyword.findMany({ where: { userId } });
    if (keywords.length === 0) {
      return Response.json({ error: "先にキーワードを生成してください" }, { status: 400 });
    }

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    const ogpFetcher = new OgpFetcher(logger.child("ogp"));
    const currentKeywords = keywords.map((k) => k.keyword);

    // 現在のキーワードに紐づかない古い記事を削除（カテゴリフィード記事は保護）
    const { count: deletedCount } = await prisma.feedArticle.deleteMany({
      where: {
        userId,
        keyword: {
          notIn: currentKeywords,
          not: { startsWith: "__category_" },
        },
      },
    });

    // Phase 1: 日本語ソース + カテゴリフィード + キーワード翻訳を並列実行
    let translationMap = new Map<string, string>();
    const [jpResults, categoryArticles] = await Promise.all([
      // 日本語キーワードでの検索（英語ソースはスキップ → keywordEnなし）
      Promise.allSettled(
        currentKeywords.map((kw) => fetcher.fetchByKeyword(kw))
      ),
      // カテゴリフィード
      fetcher.fetchCategoryFeeds(),
      // キーワード翻訳（結果をtranslationMapに代入）
      (async () => {
        try {
          const { apiKey } = await resolveApiKey(userId, "openai");
          const llmClient = createLLMClient("openai", undefined, false, apiKey);
          const translator = new KeywordTranslator(
            llmClient,
            feedConfig.keyword_model,
            logger.child("translator")
          );
          translationMap = await translator.translate(currentKeywords);
        } catch (error) {
          logger.warn("Translation skipped", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })(),
    ]);

    const jpArticles: FeedArticleData[] = jpResults
      .filter(
        (r): r is PromiseFulfilledResult<FeedArticleData[]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value);

    // Phase 2: 英語キーワードでの再検索（翻訳が利用可能な場合）
    let enArticles: FeedArticleData[] = [];
    if (translationMap.size > 0) {
      const enResults = await Promise.allSettled(
        currentKeywords.map((kw) => {
          const enKw = translationMap.get(kw);
          if (!enKw) return Promise.resolve([]);
          return fetcher.fetchByKeyword(kw, enKw);
        })
      );
      enArticles = enResults
        .filter(
          (r): r is PromiseFulfilledResult<FeedArticleData[]> =>
            r.status === "fulfilled"
        )
        .flatMap((r) => r.value);
    }

    const allArticles = [...jpArticles, ...categoryArticles, ...enArticles];

    // OGP画像はneedsOgpFetch()でフィルタしたもののみ取得
    const ogpTargets = allArticles.filter(NewsFetcher.needsOgpFetch);
    const imageMap = ogpTargets.length > 0
      ? await ogpFetcher.fetchImageUrls(ogpTargets)
      : new Map<string, string>();

    // バルクインサート（重複スキップ）— RSS画像を優先
    const { count: newCount } = await prisma.feedArticle.createMany({
      data: allArticles.map((article) => ({
        userId,
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        snippet: article.snippet,
        publishedAt: article.publishedAt,
        keyword: article.keyword,
        imageUrl: article.imageUrl ?? imageMap.get(article.url),
      })),
      skipDuplicates: true,
    });

    logger.info("Feed refreshed", { userId, newCount, deletedCount });
    return Response.json({ newCount });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      logger.error("Feed refresh error", { message: error instanceof Error ? error.message : String(error) });
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
