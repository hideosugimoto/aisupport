import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLLMClient } from "@/lib/llm/client-factory";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { KeywordGenerator } from "@/lib/feed/keyword-generator";
import type { KeywordMode } from "@/lib/feed/keyword-generator";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed-keywords");

const VALID_MODES: KeywordMode[] = ["wide", "standard", "deep"];

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json(
        { error: "フィード機能はProプランで利用できます" },
        { status: 403 }
      );
    }

    // modeパラメータ取得
    let mode: KeywordMode = "standard";
    try {
      const body = await request.json();
      if (body.mode && VALID_MODES.includes(body.mode)) {
        mode = body.mode;
      }
    } catch {
      // bodyなしの場合はデフォルト(standard)
    }

    // レートリミット（1時間に1回）
    const lastKeyword = await prisma.feedKeyword.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (lastKeyword) {
      const cooldownMs = 60 * 60 * 1000;
      if (Date.now() - lastKeyword.createdAt.getTime() < cooldownMs) {
        return Response.json({ error: "キーワード生成は1時間に1回まで" }, { status: 429 });
      }
    }

    const compassItems = await prisma.compassItem.findMany({
      where: { userId },
      select: { title: true, content: true },
    });

    if (compassItems.length === 0) {
      return Response.json(
        { error: "マイゴールを追加してからキーワードを生成してください" },
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
    const keywords = await generator.generate(compassItems, mode);

    if (keywords.length === 0) {
      return Response.json(
        { error: "キーワードの生成に失敗しました" },
        { status: 500 }
      );
    }

    // $transactionでアトミック化
    await prisma.$transaction([
      prisma.feedKeyword.deleteMany({ where: { userId } }),
      prisma.feedKeyword.createMany({
        data: keywords.map((keyword) => ({ userId, keyword })),
      }),
    ]);

    logger.info("Keywords generated", { userId, count: keywords.length, mode });
    return Response.json({ keywords });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      logger.error("Keyword generation error", { message: error instanceof Error ? error.message : String(error) });
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
