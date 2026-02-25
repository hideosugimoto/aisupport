import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { FeedRefreshService } from "@/lib/feed/feed-refresh-service";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

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

    const service = new FeedRefreshService(logger);
    let totalNew = 0;

    // カテゴリフィードは全ユーザー共通なのでループ外で1回だけ取得
    const categoryArticles = await service.fetchCategoryFeeds();

    for (const [userId, keywords] of keywordsByUser) {
      const { newCount } = await service.refreshForUserWithCategory(
        userId,
        keywords,
        categoryArticles
      );
      totalNew += newCount;
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
