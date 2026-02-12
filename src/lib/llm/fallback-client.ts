import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError } from "./errors";

export class FallbackLLMClient implements LLMClient {
  constructor(
    private primary: LLMClient,
    private fallbacks: LLMClient[]
  ) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.primary.chat(request);
    } catch (error) {
      if (error instanceof LLMError && this.isRetryable(error)) {
        for (const fallback of this.fallbacks) {
          try {
            return await fallback.chat(request);
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    try {
      yield* this.primary.chatStream(request);
    } catch (error) {
      if (error instanceof LLMError && this.isRetryable(error)) {
        for (const fallback of this.fallbacks) {
          try {
            yield* fallback.chatStream(request);
            return;
          } catch {
            continue;
          }
        }
      }
      throw error;
    }
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    return this.primary.extractUsage(rawResponse);
  }

  private isRetryable(error: LLMError): boolean {
    return error.code === "RATE_LIMITED" || error.code === "SERVER_ERROR";
  }
}
