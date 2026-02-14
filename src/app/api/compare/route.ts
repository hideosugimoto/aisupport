import { NextRequest } from "next/server";
import { validateTaskInput } from "@/lib/validation/task-input";
import { DefaultParallelDecisionEngine } from "@/lib/compare/parallel-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { formatError } from "@/lib/api/format-error";
import type { LLMProvider } from "@/lib/llm/types";
import featuresConfig from "../../../../config/features.json";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { checkRequestLimit } from "@/lib/billing/plan-gate";
import { resolveApiKey } from "@/lib/billing/key-resolver";

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
      provider: body.provider ?? featuresConfig.default_provider,
    });

    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    const providers = featuresConfig.enabled_providers as LLMProvider[];
    const resolvedKeys = await Promise.all(
      providers.map((p) => resolveApiKey(userId, p))
    );
    const clients: Partial<Record<LLMProvider, ReturnType<typeof createLLMClient>>> = {};
    providers.forEach((provider, i) => {
      clients[provider] = createLLMClient(provider, undefined, false, resolvedKeys[i].apiKey);
    });

    const engine = new DefaultParallelDecisionEngine(clients);

    const results = await engine.compareAll(
      userId,
      {
        tasks: body.tasks,
        availableTime: body.availableTime,
        energyLevel: body.energyLevel,
      },
      body.models
    );

    return Response.json({ results });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      const errorData = formatError(error);
      return Response.json(errorData, { status: errorData.status });
    }
  }
}
