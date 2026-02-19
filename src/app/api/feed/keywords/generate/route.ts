import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLLMClient } from "@/lib/llm/client-factory";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { KeywordGenerator } from "@/lib/feed/keyword-generator";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed-keywords");

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

    const compassItems = await prisma.compassItem.findMany({
      where: { userId },
      select: { title: true, content: true },
    });

    if (compassItems.length === 0) {
      return Response.json(
        { error: "羅針盤にアイテムを追加してからキーワードを生成してください" },
        { status: 400 }
      );
    }

    const { apiKey } = await resolveApiKey(userId, "openai");
    const llmClient = createLLMClient("openai", undefined, false, apiKey);
    const generator = new KeywordGenerator(
      llmClient,
      feedConfig.keyword_model,
      logger.child("generator")
    );
    const keywords = await generator.generate(compassItems);

    if (keywords.length === 0) {
      return Response.json(
        { error: "キーワードの生成に失敗しました" },
        { status: 500 }
      );
    }

    await prisma.feedKeyword.deleteMany({ where: { userId } });
    await prisma.feedKeyword.createMany({
      data: keywords.map((keyword) => ({ userId, keyword })),
    });

    logger.info("Keywords generated", { userId, count: keywords.length });
    return Response.json({ keywords });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      logger.error("Keyword generation error");
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
