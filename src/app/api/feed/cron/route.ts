import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { FeedRefreshService } from "@/lib/feed/feed-refresh-service";
import { createLogger } from "@/lib/logger";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("cron:feed");

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

    // ユーザーを並列処理（同時実行数制限付き）
    const userEntries = Array.from(keywordsByUser.entries());
    const concurrency = feedConfig.cron_user_concurrency ?? 3;
    for (let i = 0; i < userEntries.length; i += concurrency) {
      const batch = userEntries.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(([userId, keywords]) =>
          service.refreshForUserWithCategory(userId, keywords, categoryArticles)
        )
      );
      for (const [idx, r] of results.entries()) {
        if (r.status === "fulfilled") {
          totalNew += r.value.newCount;
        } else {
          logger.warn("User refresh failed", {
            userId: batch[idx][0],
            message: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
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
