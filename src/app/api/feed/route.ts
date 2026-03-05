import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed");

const VALID_CATEGORIES = ["news", "blog"] as const;

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

    // categoryバリデーション
    const rawCategory = searchParams.get("category") ?? "news";
    if (!(VALID_CATEGORIES as readonly string[]).includes(rawCategory)) {
      return Response.json({ error: "無効なカテゴリです" }, { status: 400 });
    }
    const category = rawCategory;

    // pageバリデーション
    const rawPage = Number(searchParams.get("page") ?? "1");
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
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
      logger.error("Feed fetch error", { message: error instanceof Error ? error.message : String(error) });
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
