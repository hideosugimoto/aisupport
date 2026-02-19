import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:feed-refresh");

export async function POST() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json(
        { error: "フィード機能はProプランで利用できます" },
        { status: 403 }
      );
    }

    const keywords = await prisma.feedKeyword.findMany({ where: { userId } });
    if (keywords.length === 0) {
      return Response.json(
        { error: "先にキーワードを生成してください" },
        { status: 400 }
      );
    }

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    let newCount = 0;

    for (const { keyword } of keywords) {
      const articles = await fetcher.fetchByKeyword(keyword);
      for (const article of articles) {
        try {
          await prisma.feedArticle.upsert({
            where: { userId_url: { userId, url: article.url } },
            update: {},
            create: {
              userId,
              title: article.title,
              url: article.url,
              source: article.source,
              category: article.category,
              snippet: article.snippet,
              publishedAt: article.publishedAt,
              keyword: article.keyword,
            },
          });
          newCount++;
        } catch {
          // duplicate — skip
        }
      }
    }

    logger.info("Feed refreshed", { userId, newCount });
    return Response.json({ newCount });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      logger.error("Feed refresh error");
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
