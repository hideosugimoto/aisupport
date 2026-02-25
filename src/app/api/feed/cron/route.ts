import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { OgpFetcher } from "@/lib/feed/ogp-fetcher";
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
    // 全Proユーザーのキーワードを一括取得（N+1解消）
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

    for (const [userId, keywords] of keywordsByUser) {
      // ユーザー内キーワードを並列fetch
      const results = await Promise.allSettled(
        keywords.map((keyword) => fetcher.fetchByKeyword(keyword))
      );

      const allArticles: FeedArticleData[] = results
        .filter((r): r is PromiseFulfilledResult<FeedArticleData[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);

      if (allArticles.length > 0) {
        // OGP画像を並列取得
        const imageMap = await ogpFetcher.fetchImageUrls(allArticles);

        // バルクインサート（重複スキップ）
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
            imageUrl: imageMap.get(article.url),
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
