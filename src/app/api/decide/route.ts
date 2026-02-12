import { NextRequest } from "next/server";
import { validateTaskInput } from "@/lib/validation/task-input";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { LLMError } from "@/lib/llm/errors";
import type { LLMProvider } from "@/lib/llm/types";
import featuresConfig from "../../../../config/features.json";

const repository = new PrismaUsageLogRepository(prisma);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateTaskInput({
      tasks: body.tasks ?? [],
      availableTime: body.availableTime ?? 0,
      energyLevel: body.energyLevel ?? 0,
      provider: body.provider ?? "",
    });

    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    const provider = body.provider as LLMProvider;
    const model =
      body.model ??
      featuresConfig.default_model[
        provider as keyof typeof featuresConfig.default_model
      ];

    const client = createLLMClient(provider);
    const engine = new TaskDecisionEngine(client, repository, provider, model);

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of engine.decideStream({
              tasks: body.tasks,
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

    const result = await engine.decide({
      tasks: body.tasks,
      availableTime: body.availableTime,
      energyLevel: body.energyLevel,
    });

    return Response.json(result);
  } catch (error) {
    const errorData = formatError(error);
    return Response.json(errorData, { status: errorData.status });
  }
}

function formatError(error: unknown): {
  error: string;
  code?: string;
  status: number;
} {
  if (error instanceof LLMError) {
    const statusMap: Record<string, number> = {
      RATE_LIMITED: 429,
      AUTH_FAILED: 401,
      TIMEOUT: 504,
      SERVER_ERROR: 502,
      NETWORK_ERROR: 503,
    };
    const userMessageMap: Record<string, string> = {
      RATE_LIMITED: "リクエスト制限に達しました。しばらく待ってから再試行してください",
      AUTH_FAILED: "AIエンジンの認証に失敗しました",
      TIMEOUT: "リクエストがタイムアウトしました",
      SERVER_ERROR: "AIエンジンでエラーが発生しました",
      NETWORK_ERROR: "ネットワークエラーが発生しました",
    };
    return {
      error: userMessageMap[error.code] ?? "エラーが発生しました",
      code: error.code,
      status: statusMap[error.code] ?? 500,
    };
  }
  return {
    error: "内部エラーが発生しました",
    status: 500,
  };
}
