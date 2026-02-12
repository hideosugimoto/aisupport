import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError, type LLMErrorCode } from "./errors";

export class MockLLMClient implements LLMClient {
  public callCount = 0;
  public lastRequest: LLMRequest | null = null;

  constructor(
    private fixedResponse: string,
    private options?: {
      usage?: TokenUsage;
      errorOnCall?: { code: LLMErrorCode; message: string };
    }
  ) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.callCount++;
    this.lastRequest = request;

    if (this.options?.errorOnCall) {
      throw new LLMError(
        this.options.errorOnCall.code,
        "mock",
        false,
        this.options.errorOnCall.message
      );
    }

    return {
      content: this.fixedResponse,
      usage: this.options?.usage ?? {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      requestId: `mock-${this.callCount}`,
    };
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.callCount++;
    this.lastRequest = request;

    if (this.options?.errorOnCall) {
      throw new LLMError(
        this.options.errorOnCall.code,
        "mock",
        false,
        this.options.errorOnCall.message
      );
    }

    const words = this.fixedResponse.split(" ");
    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      yield {
        content: (i > 0 ? " " : "") + words[i],
        done: isLast,
        ...(isLast
          ? {
              usage: this.options?.usage ?? {
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150,
              },
            }
          : {}),
      };
    }
  }

  extractUsage(_rawResponse: unknown): TokenUsage {
    return (
      this.options?.usage ?? {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      }
    );
  }
}
