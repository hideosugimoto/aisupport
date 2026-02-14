import { NextRequest, NextResponse } from "next/server";
import { DefaultWeeklyReviewEngine } from "@/lib/strategy/weekly-review";
import { createLLMClient } from "@/lib/llm/client-factory";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import { formatError } from "@/lib/api/format-error";
import featuresConfig from "../../../../config/features.json";
import type { LLMProvider } from "@/lib/llm/types";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";

const VALID_PROVIDERS = new Set(featuresConfig.enabled_providers);

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const plan = await getUserPlan(userId);
    if (!plan.weeklyReviewEnabled) {
      return NextResponse.json(
        { error: "週次レビューはProプランで利用できます" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const provider = body.provider || featuresConfig.default_provider;

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: "無効なプロバイダーです" },
        { status: 400 }
      );
    }

    const llmClient = createLLMClient(provider as LLMProvider, undefined, false);
    const repository = new PrismaTaskDecisionRepository(prisma);
    const engine = new DefaultWeeklyReviewEngine(llmClient, repository);

    const result = await engine.generateReview(userId, provider);

    return NextResponse.json(result);
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      const errorData = formatError(error);
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.status }
      );
    }
  }
}
