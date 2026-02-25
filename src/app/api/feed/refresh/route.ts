import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { OgpFetcher } from "@/lib/feed/ogp-fetcher";
import { createLogger } from "@/lib/logger";
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

    // 現在のキーワードに紐づかない古い記事を削除
    const { count: deletedCount } = await prisma.feedArticle.deleteMany({
      where: {
        userId,
        keyword: { notIn: currentKeywords },
      },
    });

    // 並列でRSS取得
    const results = await Promise.allSettled(
      keywords.map(({ keyword }) => fetcher.fetchByKeyword(keyword))
    );

    const allArticles: FeedArticleData[] = results
      .filter((r): r is PromiseFulfilledResult<FeedArticleData[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // OGP画像を並列取得
    const imageMap = await ogpFetcher.fetchImageUrls(allArticles);

    // バルクインサート（重複スキップ）
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
        imageUrl: imageMap.get(article.url),
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
