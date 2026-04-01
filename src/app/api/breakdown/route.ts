import { NextRequest } from "next/server";
import { validateBreakdownInput } from "@/lib/validation/task-breakdown-input";
import { TaskBreakdownEngine } from "@/lib/decision/task-breakdown-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { formatError } from "@/lib/api/format-error";
import { getDefaultModel } from "@/lib/config/types";
import type { LLMProvider } from "@/lib/llm/types";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { checkRequestLimit, getUserPlan, checkModelAccess } from "@/lib/billing/plan-gate";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLogger } from "@/lib/logger";
import { isAllowedModel } from "@/lib/validation/model-validation";

const repository = new PrismaUsageLogRepository(prisma);
const logger = createLogger("api:breakdown");

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    logger.info("リクエスト受信", { userId });

    const limitCheck = await checkRequestLimit(userId);
    if (!limitCheck.allowed) {
      return Response.json(
        { error: "今月のリクエスト上限に達しました。Proプランにアップグレードしてください。", remaining: limitCheck.remaining },
        { status: 429 }
      );
    }

    const body = await request.json();

    const validation = validateBreakdownInput({
      task: body.task ?? "",
      availableTime: body.availableTime ?? 0,
      energyLevel: body.energyLevel ?? 0,
      provider: body.provider ?? "",
    });

    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    const provider = body.provider as LLMProvider;
    const model = body.model ?? getDefaultModel(provider);
    if (body.model && !isAllowedModel(provider, model)) {
      return Response.json({ error: "無効なモデルです" }, { status: 400 });
    }
    const enableFallback = body.fallback ?? false;

    const plan = await getUserPlan(userId);
    const { apiKey, source } = await resolveApiKey(userId, provider);
    const modelCheck = checkModelAccess(plan, provider, model, source);
    if (!modelCheck.allowed) {
      return Response.json({ error: modelCheck.error }, { status: 403 });
    }
    const client = createLLMClient(provider, undefined, enableFallback, apiKey);
    const engine = new TaskBreakdownEngine(client, repository, provider, model);

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of engine.breakdownStream(userId, {
              task: body.task,
              availableTime: body.availableTime,
              energyLevel: body.energyLevel,
            })) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            const errorData = formatError(error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorData })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await engine.breakdown(userId, {
      task: body.task,
      availableTime: body.availableTime,
      energyLevel: body.energyLevel,
    });

    logger.info("レスポンス返却");
    return Response.json(result);
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      const errorData = formatError(error);
      return Response.json(errorData, { status: errorData.status });
    }
  }
}
