import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("cron:feed");

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const proUsers = await prisma.subscription.findMany({
      where: { plan: "pro", status: "active" },
      select: { userId: true },
    });

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    let totalNew = 0;

    for (const { userId } of proUsers) {
      const keywords = await prisma.feedKeyword.findMany({ where: { userId } });

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
            totalNew++;
          } catch {
            // duplicate — skip
          }
        }
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - feedConfig.article_retention_days);
    const deleted = await prisma.feedArticle.deleteMany({
      where: { fetchedAt: { lt: cutoff } },
    });

    logger.info("Cron completed", { users: proUsers.length, totalNew, deleted: deleted.count });
    return Response.json({ users: proUsers.length, totalNew, deleted: deleted.count });
  } catch (error) {
    logger.error("Cron error", { message: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
