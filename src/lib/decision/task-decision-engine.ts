import type { LLMClient, LLMStreamChunk } from "../llm/types";
import type { UsageLogRepository } from "../db/types";
import type { Retriever, RetrievalResult } from "../rag/retriever";
import type { CompassRelevance } from "../compass/types";
import { nullLogger } from "../logger/null-logger";
import type { Logger } from "../logger/types";
import {
  buildTaskDecisionMessages,
  type TaskDecisionInput,
} from "../llm/prompt-builder";
import { getDefaultModel } from "../config/types";
import featuresConfig from "../../../config/features.json";

const RETRIEVAL_TIMEOUT_MS = featuresConfig.default_timeout_ms;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export interface DecisionContextHints {
  hasRag: boolean;
  hasCompass: boolean;
  energyLevelUsed: number;
  availableTimeUsed: number;
}

export interface DecisionResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  isAnxietyMode: boolean;
  promptVersion?: string;
  compassRelevance?: CompassRelevance;
  contextHints?: DecisionContextHints;
}

export class TaskDecisionEngine {
  private retriever?: Retriever;
  private compassRetriever?: Retriever;

  constructor(
    private client: LLMClient,
    private repository: UsageLogRepository,
    private provider: string,
    private model?: string,
    private logger: Logger = nullLogger,
    private keySource: "user" | "platform" = "platform"
  ) {}

  setRetriever(retriever: Retriever): void {
    this.retriever = retriever;
  }

  setCompassRetriever(retriever: Retriever): void {
    this.compassRetriever = retriever;
  }

  private async fetchRagContext(userId: string, input: TaskDecisionInput): Promise<string | undefined> {
    if (!this.retriever) return undefined;
    try {
      const query = input.tasks.join(" ");
      const result = await this.retriever.retrieve(userId, query);
      return result.contextText || undefined;
    } catch (error) {
      this.logger.warn("[RAG] 検索失敗（続行）", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  private async fetchCompassContext(userId: string, input: TaskDecisionInput): Promise<string | undefined> {
    const result = await this.fetchCompassResult(userId, input);
    return result?.contextText || undefined;
  }

  private async fetchCompassResult(userId: string, input: TaskDecisionInput): Promise<RetrievalResult | undefined> {
    if (!this.compassRetriever) return undefined;
    try {
      const query = input.tasks.join(" ");
      return await this.compassRetriever.retrieve(userId, query);
    } catch (error) {
      this.logger.warn("[Compass] 検索失敗（続行）", { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  async decide(userId: string, input: TaskDecisionInput): Promise<DecisionResult> {
    // A/B テスト: プロンプトバージョン選択
    const promptVersion = this.selectPromptVersion();

    // RAG と Compass を並列取得（タイムアウト + エラーハンドリング付き）
    const [ragContext, compassResult] = await Promise.all([
      withTimeout(this.fetchRagContext(userId, input), RETRIEVAL_TIMEOUT_MS, undefined),
      withTimeout(this.fetchCompassResult(userId, input), RETRIEVAL_TIMEOUT_MS, undefined),
    ]);
    const compassContext = compassResult?.contextText || undefined;

    const messages = buildTaskDecisionMessages(input, promptVersion, ragContext, compassContext);
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
      userId,
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      feature: "task_decision",
      keySource: this.keySource,
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
      compassRelevance: compassResult ? {
        hasCompass: true,
        topMatches: compassResult.results.map(r => ({ title: r.filename, similarity: r.similarity })),
      } : undefined,
      contextHints: {
        hasRag: !!ragContext,
        hasCompass: !!compassContext,
        energyLevelUsed: input.energyLevel,
        availableTimeUsed: input.availableTime,
      },
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

  async prepareStream(
    userId: string,
    input: TaskDecisionInput
  ): Promise<{ stream: AsyncIterable<LLMStreamChunk>; meta: DecisionStreamMeta }> {
    // A/B テスト: プロンプトバージョン選択
    const promptVersion = this.selectPromptVersion();

    // RAG と Compass を並列取得（タイムアウト付き）
    const [ragContext, compassResult] = await Promise.all([
      withTimeout(this.fetchRagContext(userId, input), RETRIEVAL_TIMEOUT_MS, undefined),
      withTimeout(this.fetchCompassResult(userId, input), RETRIEVAL_TIMEOUT_MS, undefined),
    ]);
    const compassContext = compassResult?.contextText || undefined;
    const messages = buildTaskDecisionMessages(input, promptVersion, ragContext, compassContext);
    const model = this.model ?? getDefaultModel(this.provider);

    const meta: DecisionStreamMeta = {
      compassRelevance: compassResult ? {
        hasCompass: true,
        topMatches: compassResult.results.map(r => ({ title: r.filename, similarity: r.similarity })),
      } : undefined,
      contextHints: {
        hasRag: !!ragContext,
        hasCompass: !!compassContext,
        energyLevelUsed: input.energyLevel,
        availableTimeUsed: input.availableTime,
      },
    };

    const client = this.client;
    const repository = this.repository;
    const provider = this.provider;
    const keySource = this.keySource;
    const isAnxietyMode =
      input.energyLevel <= featuresConfig.anxiety_mode_threshold;

    async function* createStream(): AsyncIterable<LLMStreamChunk> {
      let lastUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let hasUsage = false;

      try {
        for await (const chunk of client.chatStream({ model, messages })) {
          if (chunk.usage) {
            lastUsage = chunk.usage;
            hasUsage = true;
          }
          yield chunk;
        }
      } finally {
        if (hasUsage) {
          const metadata = JSON.stringify({
            prompt_version: promptVersion || "default",
            anxiety_mode: isAnxietyMode,
          });

          await repository.save({
            userId,
            provider,
            model,
            inputTokens: lastUsage.inputTokens,
            outputTokens: lastUsage.outputTokens,
            totalTokens: lastUsage.totalTokens,
            feature: "task_decision",
            keySource,
            metadata,
          });
        }
      }
    }

    return { stream: createStream(), meta };
  }
}

export interface DecisionStreamMeta {
  compassRelevance?: CompassRelevance;
  contextHints: DecisionContextHints;
}
