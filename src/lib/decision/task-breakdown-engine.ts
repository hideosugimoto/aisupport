import type { LLMClient, LLMStreamChunk } from "../llm/types";
import type { UsageLogRepository } from "../db/types";
import {
  buildTaskBreakdownMessages,
  type TaskBreakdownInput,
} from "../llm/prompt-builder";
import featuresConfig from "../../../config/features.json";

export interface BreakdownResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export class TaskBreakdownEngine {
  constructor(
    private client: LLMClient,
    private repository: UsageLogRepository,
    private provider: string,
    private model?: string
  ) {}

  async breakdown(input: TaskBreakdownInput): Promise<BreakdownResult> {
    const messages = buildTaskBreakdownMessages(input);
    const model =
      this.model ??
      featuresConfig.default_model[
        this.provider as keyof typeof featuresConfig.default_model
      ];

    const response = await this.client.chat({ model, messages });

    await this.repository.save({
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      feature: "task_breakdown",
      requestId: response.requestId,
    });

    return {
      content: response.content,
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
    };
  }

  async *breakdownStream(
    input: TaskBreakdownInput
  ): AsyncIterable<LLMStreamChunk> {
    const messages = buildTaskBreakdownMessages(input);
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
          feature: "task_breakdown",
        });
      }
    }
  }
}
