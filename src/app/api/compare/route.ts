import { NextRequest } from "next/server";
import { validateTaskInput } from "@/lib/validation/task-input";
import { DefaultParallelDecisionEngine } from "@/lib/compare/parallel-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { formatError } from "@/lib/api/format-error";
import type { LLMProvider } from "@/lib/llm/types";
import featuresConfig from "../../../../config/features.json";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateTaskInput({
      tasks: body.tasks ?? [],
      availableTime: body.availableTime ?? 0,
      energyLevel: body.energyLevel ?? 0,
      provider: body.provider ?? featuresConfig.default_provider,
    });

    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    // 有効な全プロバイダーのクライアントを作成
    const clients: Partial<Record<LLMProvider, any>> = {};
    for (const provider of featuresConfig.enabled_providers as LLMProvider[]) {
      clients[provider] = createLLMClient(provider);
    }

    const engine = new DefaultParallelDecisionEngine(clients);

    const results = await engine.compareAll({
      tasks: body.tasks,
      availableTime: body.availableTime,
      energyLevel: body.energyLevel,
    });

    return Response.json({ results });
  } catch (error) {
    const errorData = formatError(error);
    return Response.json(errorData, { status: errorData.status });
  }
}
