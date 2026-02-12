import type { LLMClient, LLMStreamChunk } from "../llm/types";
import type { UsageLogRepository } from "../db/types";
import type { Retriever } from "../rag/retriever";
import {
  buildTaskDecisionMessages,
  type TaskDecisionInput,
} from "../llm/prompt-builder";
import { getDefaultModel } from "../config/types";
import featuresConfig from "../../../config/features.json";

export interface DecisionResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  isAnxietyMode: boolean;
  promptVersion?: string;
}

export class TaskDecisionEngine {
  private retriever?: Retriever;

  constructor(
    private client: LLMClient,
    private repository: UsageLogRepository,
    private provider: string,
    private model?: string
  ) {}

  setRetriever(retriever: Retriever): void {
    this.retriever = retriever;
  }

  private async fetchRagContext(input: TaskDecisionInput): Promise<string | undefined> {
    if (!this.retriever) return undefined;
    try {
      const query = input.tasks.join(" ");
      const result = await this.retriever.retrieve(query);
      return result.contextText || undefined;
    } catch (error) {
      console.warn("[RAG] 検索失敗（続行）:", error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  async decide(input: TaskDecisionInput): Promise<DecisionResult> {
    // A/B テスト: プロンプトバージョン選択
    const promptVersion = this.selectPromptVersion();
    const ragContext = await this.fetchRagContext(input);
    const messages = buildTaskDecisionMessages(input, promptVersion, ragContext);
    const model = this.model ?? getDefaultModel(this.provider);

    const response = await this.client.chat({ model, messages });

    const isAnxietyMode =
      input.energyLevel <= featuresConfig.anxiety_mode_threshold;

    // メタデータにプロンプトバージョンを記録
    const metadata = JSON.stringify({
      prompt_version: promptVersion || "default",
      anxiety_mode: isAnxietyMode,
    });

    await this.repository.save({
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      feature: "task_decision",
      requestId: response.requestId,
      metadata,
    });

    return {
      content: response.content,
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      isAnxietyMode,
      promptVersion: promptVersion || "default",
    };
  }

  /**
   * A/B テスト用プロンプトバージョン選択
   * @returns バージョン文字列 (undefined = default)
   */
  private selectPromptVersion(): string | undefined {
    const { prompt_ab_test } = featuresConfig;
    if (!prompt_ab_test.enabled) {
      return undefined; // デフォルト
    }

    // ランダムで variant_a または variant_b を選択
    const random = Math.random();
    const useVariantB = random < prompt_ab_test.split_ratio;

    if (useVariantB && prompt_ab_test.variant_b !== "default") {
      return prompt_ab_test.variant_b;
    }

    // variant_a が "default" 以外なら返す
    if (prompt_ab_test.variant_a !== "default") {
      return prompt_ab_test.variant_a;
    }

    return undefined; // デフォルト
  }

  async *decideStream(
    input: TaskDecisionInput
  ): AsyncIterable<LLMStreamChunk> {
    // A/B テスト: プロンプトバージョン選択
    const promptVersion = this.selectPromptVersion();
    const ragContext = await this.fetchRagContext(input);
    const messages = buildTaskDecisionMessages(input, promptVersion, ragContext);
    const model = this.model ?? getDefaultModel(this.provider);

    let lastUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let hasUsage = false;

    const isAnxietyMode =
      input.energyLevel <= featuresConfig.anxiety_mode_threshold;

    try {
      for await (const chunk of this.client.chatStream({ model, messages })) {
        if (chunk.usage) {
          lastUsage = chunk.usage;
          hasUsage = true;
        }
        yield chunk;
      }
    } finally {
      if (hasUsage) {
        // メタデータにプロンプトバージョンを記録
        const metadata = JSON.stringify({
          prompt_version: promptVersion || "default",
          anxiety_mode: isAnxietyMode,
        });

        await this.repository.save({
          provider: this.provider,
          model,
          inputTokens: lastUsage.inputTokens,
          outputTokens: lastUsage.outputTokens,
          totalTokens: lastUsage.totalTokens,
          feature: "task_decision",
          metadata,
        });
      }
    }
  }
}
