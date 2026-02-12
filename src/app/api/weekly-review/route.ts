import { NextRequest, NextResponse } from "next/server";
import { DefaultWeeklyReviewEngine } from "@/lib/strategy/weekly-review";
import { createLLMClient } from "@/lib/llm/client-factory";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import featuresConfig from "../../../../config/features.json";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = body.provider || featuresConfig.default_provider;

    const llmClient = createLLMClient(provider, undefined, false);
    const repository = new PrismaTaskDecisionRepository(prisma);
    const engine = new DefaultWeeklyReviewEngine(llmClient, repository);

    const result = await engine.generateReview(provider);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Weekly review error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
