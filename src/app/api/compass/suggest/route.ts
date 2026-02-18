import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { CompassSuggester } from "@/lib/compass/compass-suggester";
import { DefaultNeglectDetector } from "@/lib/compass/neglect-detector";
import { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { createLLMClient } from "@/lib/llm/client-factory";
import { getDefaultModel } from "@/lib/config/types";
import type { LLMProvider } from "@/lib/llm/types";
import { checkRequestLimit } from "@/lib/billing/plan-gate";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLogger } from "@/lib/logger";
import featuresConfig from "@/../config/features.json";

const logger = createLogger("api:compass-suggest");

const MAX_TASKS = 10;
const MAX_TASK_LENGTH = 200;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    logger.info("リクエスト受信", { userId });

    const limitCheck = await checkRequestLimit(userId);
    if (!limitCheck.allowed) {
      return Response.json({ suggestion: null });
    }

    const body = await request.json();
    const { tasks, timeMinutes, energyLevel } = body;

    // Validation — bounds + type checks (W6: reject empty strings)
    if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > MAX_TASKS) {
      return Response.json({ suggestion: null });
    }
    if (tasks.some((t: unknown) => typeof t !== "string" || (t as string).trim().length === 0 || (t as string).length > MAX_TASK_LENGTH)) {
      return Response.json({ suggestion: null });
    }
    if (typeof timeMinutes !== "number" || !Number.isFinite(timeMinutes) || timeMinutes <= 0 || timeMinutes > 1440) {
      return Response.json({ suggestion: null });
    }
    if (typeof energyLevel !== "number" || !Number.isInteger(energyLevel) || energyLevel < 1 || energyLevel > 5) {
      return Response.json({ suggestion: null });
    }

    // Provider/model validation (W1: whitelist model, W3: move OPENAI_API_KEY check after provider)
    const providerRaw = body.provider ?? "openai";
    if (!featuresConfig.enabled_providers.includes(providerRaw)) {
      return Response.json({ suggestion: null });
    }
    const provider = providerRaw as LLMProvider;
    const model = body.model ?? getDefaultModel(provider);
    const allowedModels = featuresConfig.available_models[provider as keyof typeof featuresConfig.available_models] ?? [];
    if (body.model && !allowedModels.includes(model)) {
      return Response.json({ suggestion: null });
    }

    // Embedder requires OPENAI_API_KEY regardless of LLM provider
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ suggestion: null });
    }

    const { apiKey } = await resolveApiKey(userId, provider);
    const embedder = new OpenAIEmbedder();
    const vectorStore = new PrismaCompassVectorStore();
    const detectorLogger = logger.child("detector");
    const detector = new DefaultNeglectDetector(embedder, vectorStore, detectorLogger);
    const llmClient = createLLMClient(provider, undefined, false, apiKey);
    const suggesterLogger = logger.child("suggester");
    const suggester = new CompassSuggester(detector, llmClient, model, suggesterLogger);

    const suggestion = await suggester.suggest(userId, {
      tasks: tasks as string[],
      timeMinutes,
      energyLevel,
    });

    logger.info("レスポンス返却", { hasSuggestion: suggestion !== null });
    return Response.json({ suggestion });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      // Non-auth errors: return null suggestion instead of error
      return Response.json({ suggestion: null });
    }
  }
}
