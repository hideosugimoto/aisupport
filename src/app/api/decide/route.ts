import { NextRequest } from "next/server";
import { validateTaskInput } from "@/lib/validation/task-input";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { formatError } from "@/lib/api/format-error";
import { getDefaultModel } from "@/lib/config/types";
import type { LLMProvider } from "@/lib/llm/types";

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
    const model = body.model ?? getDefaultModel(provider);
    const enableFallback = body.fallback ?? false;

    const client = createLLMClient(provider, undefined, enableFallback);
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
