import { describe, it, expect, vi } from "vitest";
import { LLMClientWrapper, type RetryConfig } from "@/lib/llm/client-wrapper";
import { LLMError } from "@/lib/llm/errors";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";

function createMockClient(overrides?: Partial<LLMClient>): LLMClient {
  return {
    chat: vi.fn<(req: LLMRequest) => Promise<LLMResponse>>().mockResolvedValue({
      content: "mock response",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      requestId: "test-123",
    }),
    chatStream: vi.fn<(req: LLMRequest) => AsyncIterable<LLMStreamChunk>>(),
    extractUsage: vi.fn<(raw: unknown) => TokenUsage>().mockReturnValue({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    }),
    ...overrides,
  };
}

const testRequest: LLMRequest = {
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "hello" }],
};

const fastConfig: RetryConfig = { maxRetries: 3, timeoutMs: 5000 };

describe("LLMClientWrapper", () => {
  it("should forward successful chat calls", async () => {
    const mock = createMockClient();
    const wrapper = new LLMClientWrapper(mock, fastConfig);

    const result = await wrapper.chat(testRequest);

    expect(result.content).toBe("mock response");
    expect(mock.chat).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors", async () => {
    const rateLimitError = new LLMError(
      "RATE_LIMITED",
      "openai",
      true,
      "Rate limited"
    );
    const mockChat = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        content: "success after retry",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

    const mock = createMockClient({ chat: mockChat });
    const wrapper = new LLMClientWrapper(mock, {
      maxRetries: 3,
      timeoutMs: 30000,
    });

    const result = await wrapper.chat(testRequest);

    expect(result.content).toBe("success after retry");
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it("should throw immediately on non-retryable errors", async () => {
    const authError = new LLMError(
      "AUTH_FAILED",
      "openai",
      false,
      "Invalid API key"
    );
    const mockChat = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockRejectedValue(authError);

    const mock = createMockClient({ chat: mockChat });
    const wrapper = new LLMClientWrapper(mock, fastConfig);

    await expect(wrapper.chat(testRequest)).rejects.toThrow(authError);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it("should throw after exhausting retries", async () => {
    const serverError = new LLMError(
      "SERVER_ERROR",
      "openai",
      true,
      "Internal server error"
    );
    const mockChat = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockRejectedValue(serverError);

    const mock = createMockClient({ chat: mockChat });
    const wrapper = new LLMClientWrapper(mock, {
      maxRetries: 2,
      timeoutMs: 30000,
    });

    await expect(wrapper.chat(testRequest)).rejects.toThrow(serverError);
    // 1 initial + 2 retries = 3 total
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it("should throw TIMEOUT error when request exceeds timeout", async () => {
    const mockChat = vi
      .fn<(req: LLMRequest) => Promise<LLMResponse>>()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          content: "late",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }), 10000))
      );

    const mock = createMockClient({ chat: mockChat });
    const wrapper = new LLMClientWrapper(mock, {
      maxRetries: 0,
      timeoutMs: 100,
    });

    await expect(wrapper.chat(testRequest)).rejects.toThrow(LLMError);
    await expect(wrapper.chat(testRequest)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("should delegate extractUsage to underlying client", () => {
    const mock = createMockClient();
    const wrapper = new LLMClientWrapper(mock, fastConfig);

    const usage = wrapper.extractUsage({});

    expect(usage.totalTokens).toBe(15);
    expect(mock.extractUsage).toHaveBeenCalled();
  });
});
