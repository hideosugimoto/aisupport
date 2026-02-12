import type { LLMClient, TokenUsage, LLMProvider } from "../llm/types";
import type { TaskDecisionInput } from "../llm/prompt-builder";
import { buildTaskDecisionMessages } from "../llm/prompt-builder";
import { getDefaultModel } from "../config/types";
import { calculateCostUsd } from "../cost/pricing";

export interface CompareResult {
  provider: LLMProvider;
  decision: string;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
  model: string;
  error?: string;
}

export interface ParallelDecisionEngine {
  compareAll(input: TaskDecisionInput, models?: Partial<Record<LLMProvider, string>>): Promise<CompareResult[]>;
}

export class DefaultParallelDecisionEngine implements ParallelDecisionEngine {
  constructor(
    private clients: Partial<Record<LLMProvider, LLMClient>>
  ) {}

  async compareAll(input: TaskDecisionInput, models?: Partial<Record<LLMProvider, string>>): Promise<CompareResult[]> {
    const messages = buildTaskDecisionMessages(input);

    // 各エンジンの実行タスクを準備
    const tasks = Object.entries(this.clients).map(
      async ([provider, client]) => {
        const startTime = Date.now();
        const providerKey = provider as LLMProvider;
        const model = models?.[providerKey] ?? getDefaultModel(providerKey);

        try {
          const response = await client.chat({ model, messages });
          const endTime = Date.now();

          return {
            provider: providerKey,
            decision: response.content,
            usage: response.usage,
            costUsd: calculateCostUsd(
              providerKey,
              model,
              response.usage.inputTokens,
              response.usage.outputTokens
            ),
            durationMs: endTime - startTime,
            model,
          };
        } catch (error) {
          const endTime = Date.now();
          return {
            provider: providerKey,
            decision: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            costUsd: 0,
            durationMs: endTime - startTime,
            model,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    );

    // Promise.allSettled() で全エンジンを並列実行
    const results = await Promise.allSettled(tasks);

    // fulfilled のみ返す（rejected は起こらないはずだが念のため）
    return results
      .map((result) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        // rejected の場合（通常は起こらない）
        return null;
      })
      .filter((result): result is CompareResult => result !== null);
  }
}
