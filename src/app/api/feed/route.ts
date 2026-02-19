import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed");

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json(
        { error: "フィード機能はProプランで利用できます" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? "news";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const skip = (page - 1) * feedConfig.page_size;

    const [articles, total] = await Promise.all([
      prisma.feedArticle.findMany({
        where: { userId, category },
        orderBy: { publishedAt: "desc" },
        skip,
        take: feedConfig.page_size,
      }),
      prisma.feedArticle.count({ where: { userId, category } }),
    ]);

    return Response.json({
      articles,
      pagination: { page, pageSize: feedConfig.page_size, total },
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      logger.error("Feed fetch error");
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
