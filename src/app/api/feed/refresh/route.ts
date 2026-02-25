import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { FeedRefreshService } from "@/lib/feed/feed-refresh-service";
import { createLogger } from "@/lib/logger";

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

    const service = new FeedRefreshService(logger);
    const { newCount } = await service.refreshForUser(userId, currentKeywords);

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
