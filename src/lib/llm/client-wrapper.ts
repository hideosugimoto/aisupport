import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError } from "./errors";

export interface RetryConfig {
  maxRetries: number;
  timeoutMs: number;
}

export class LLMClientWrapper implements LLMClient {
  constructor(
    private client: LLMClient,
    private config: RetryConfig
  ) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    return this.withRetry(() => this.withTimeout(this.client.chat(request)));
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    yield* this.client.chatStream(request);
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    return this.client.extractUsage(rawResponse);
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: LLMError | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (error instanceof LLMError) {
          lastError = error;
          if (!error.retryable || attempt === this.config.maxRetries) {
            throw error;
          }
          // Exponential backoff with jitter (max 5s cap to prevent excessive wait)
          const baseDelay = Math.min(Math.pow(2, attempt) * 1000, 5000);
          const jitter = Math.random() * baseDelay * 0.5;
          const delay = baseDelay + jitter;
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw lastError ?? new LLMError("UNKNOWN", "unknown", false, "Retry exhausted");
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LLMError("TIMEOUT", "unknown", false, `Request timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
