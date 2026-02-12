import type { LLMClient, LLMStreamChunk } from "../llm/types";
import type { UsageLogRepository } from "../db/types";
import {
  buildTaskDecisionMessages,
  type TaskDecisionInput,
} from "../llm/prompt-builder";
import featuresConfig from "../../../config/features.json";

export interface DecisionResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  isAnxietyMode: boolean;
}

export class TaskDecisionEngine {
  constructor(
    private client: LLMClient,
    private repository: UsageLogRepository,
    private provider: string,
    private model?: string
  ) {}

  async decide(input: TaskDecisionInput): Promise<DecisionResult> {
    const messages = buildTaskDecisionMessages(input);
    const model =
      this.model ??
      featuresConfig.default_model[
        this.provider as keyof typeof featuresConfig.default_model
      ];

    const response = await this.client.chat({ model, messages });

    const isAnxietyMode =
      input.energyLevel <= featuresConfig.anxiety_mode_threshold;

    await this.repository.save({
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      feature: "task_decision",
      requestId: response.requestId,
    });

    return {
      content: response.content,
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      isAnxietyMode,
    };
  }

  async *decideStream(
    input: TaskDecisionInput
  ): AsyncIterable<LLMStreamChunk> {
    const messages = buildTaskDecisionMessages(input);
    const model =
      this.model ??
      featuresConfig.default_model[
        this.provider as keyof typeof featuresConfig.default_model
      ];

    let lastUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let hasUsage = false;

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
        await this.repository.save({
          provider: this.provider,
          model,
          inputTokens: lastUsage.inputTokens,
          outputTokens: lastUsage.outputTokens,
          totalTokens: lastUsage.totalTokens,
          feature: "task_decision",
        });
      }
    }
  }
}
