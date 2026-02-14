import { NextRequest } from "next/server";
import { validateTaskInput } from "@/lib/validation/task-input";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { formatError } from "@/lib/api/format-error";
import { getDefaultModel } from "@/lib/config/types";
import { DefaultRetriever } from "@/lib/rag/retriever";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { PrismaVectorStore } from "@/lib/rag/vector-store";
import { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";
import type { LLMProvider } from "@/lib/llm/types";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { checkRequestLimit } from "@/lib/billing/plan-gate";
import { resolveApiKey } from "@/lib/billing/key-resolver";

const repository = new PrismaUsageLogRepository(prisma);

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const limitCheck = await checkRequestLimit(userId);
    if (!limitCheck.allowed) {
      return Response.json(
        { error: "今月のリクエスト上限に達しました。Proプランにアップグレードしてください。", remaining: limitCheck.remaining },
        { status: 429 }
      );
    }

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

    const { apiKey } = await resolveApiKey(userId, provider);
    const client = createLLMClient(provider, undefined, enableFallback, apiKey);
    const engine = new TaskDecisionEngine(client, repository, provider, model);

    // RAG: ドキュメントがあれば retriever を設定
    let embedder: OpenAIEmbedder | undefined;
    if (process.env.OPENAI_API_KEY) {
      const vectorStore = new PrismaVectorStore();
      const docs = await vectorStore.listDocuments(userId);
      if (docs.length > 0) {
        embedder = new OpenAIEmbedder();
        engine.setRetriever(new DefaultRetriever(embedder, vectorStore));
      }
    }

    // Compass: 羅針盤データがあれば compassRetriever を設定
    if (process.env.OPENAI_API_KEY) {
      const compassStore = new PrismaCompassVectorStore();
      const compassEmbedder = embedder ?? new OpenAIEmbedder();
      const { CompassRetriever } = await import("@/lib/compass/compass-retriever");
      engine.setCompassRetriever(new CompassRetriever(compassEmbedder, compassStore));
    }

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of engine.decideStream(userId, {
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

    const result = await engine.decide(userId, {
      tasks: body.tasks,
      availableTime: body.availableTime,
      energyLevel: body.energyLevel,
    });

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
