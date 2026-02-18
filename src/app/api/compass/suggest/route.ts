import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { CompassSuggester } from "@/lib/compass/compass-suggester";
import { DefaultNeglectDetector } from "@/lib/compass/neglect-detector";
import { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { createLLMClient } from "@/lib/llm/client-factory";
import { getDefaultModel } from "@/lib/config/types";
import type { LLMProvider } from "@/lib/llm/types";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const body = await request.json();
    const { tasks, timeMinutes, energyLevel } = body;

    // Validation
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return Response.json({ suggestion: null });
    }
    if (typeof timeMinutes !== "number" || timeMinutes <= 0) {
      return Response.json({ suggestion: null });
    }
    if (typeof energyLevel !== "number" || energyLevel < 1 || energyLevel > 5) {
      return Response.json({ suggestion: null });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ suggestion: null });
    }

    const provider: LLMProvider = (body.provider as LLMProvider) ?? "openai";
    const model = body.model ?? getDefaultModel(provider);

    const embedder = new OpenAIEmbedder();
    const vectorStore = new PrismaCompassVectorStore();
    const detector = new DefaultNeglectDetector(embedder, vectorStore);
    const llmClient = createLLMClient(provider);
    const suggester = new CompassSuggester(detector, llmClient, model);

    const suggestion = await suggester.suggest(userId, {
      tasks,
      timeMinutes,
      energyLevel,
    });

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
