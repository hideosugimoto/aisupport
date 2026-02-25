import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLLMClient } from "@/lib/llm/client-factory";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { OgpFetcher } from "@/lib/feed/ogp-fetcher";
import { KeywordTranslator } from "@/lib/feed/keyword-translator";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";
import type { FeedArticleData } from "@/lib/feed/types";

const logger = createLogger("cron:feed");

function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const provided = Buffer.from(authHeader);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 全Proユーザーのキーワードを一括取得
    const proUsers = await prisma.subscription.findMany({
      where: { plan: "pro", status: "active" },
      select: { userId: true },
    });
    const proUserIds = proUsers.map((u) => u.userId);

    const allKeywords = await prisma.feedKeyword.findMany({
      where: { userId: { in: proUserIds } },
    });

    // ユーザーごとにグルーピング
    const keywordsByUser = new Map<string, string[]>();
    for (const kw of allKeywords) {
      const list = keywordsByUser.get(kw.userId) ?? [];
      list.push(kw.keyword);
      keywordsByUser.set(kw.userId, list);
    }

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    const ogpFetcher = new OgpFetcher(logger.child("ogp"));
    let totalNew = 0;

    // カテゴリフィードは全ユーザー共通なのでループ外で1回だけ取得
    const categoryArticles = await fetcher.fetchCategoryFeeds();

    for (const [userId, keywords] of keywordsByUser) {
      // Phase 1: 日本語ソース + キーワード翻訳を並列実行
      let translationMap = new Map<string, string>();
      const [jpResults] = await Promise.all([
        Promise.allSettled(
          keywords.map((kw) => fetcher.fetchByKeyword(kw))
        ),
        (async () => {
          try {
            const { apiKey } = await resolveApiKey(userId, "openai");
            const llmClient = createLLMClient("openai", undefined, false, apiKey);
            const translator = new KeywordTranslator(
              llmClient,
              feedConfig.keyword_model,
              logger.child("translator")
            );
            translationMap = await translator.translate(keywords);
          } catch (error) {
            logger.warn("Translation skipped for user", {
              userId,
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

      // Phase 2: 英語キーワードでの再検索
      let enArticles: FeedArticleData[] = [];
      if (translationMap.size > 0) {
        const enResults = await Promise.allSettled(
          keywords.map((kw) => {
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

      if (allArticles.length > 0) {
        // OGP画像はneedsOgpFetch()でフィルタ
        const ogpTargets = allArticles.filter(NewsFetcher.needsOgpFetch);
        const imageMap = ogpTargets.length > 0
          ? await ogpFetcher.fetchImageUrls(ogpTargets)
          : new Map<string, string>();

        const { count } = await prisma.feedArticle.createMany({
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
        totalNew += count;
      }
    }

    // 古い記事の削除
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - feedConfig.article_retention_days);
    const deleted = await prisma.feedArticle.deleteMany({
      where: { fetchedAt: { lt: cutoff } },
    });

    logger.info("Cron completed", { users: proUsers.length, totalNew, deleted: deleted.count });
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("Cron error", { message: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
