import { describe, it, expect, vi } from "vitest";
import { FallbackLLMClient } from "@/lib/llm/fallback-client";
import { LLMError } from "@/lib/llm/errors";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";

function createMockClient(
  behavior: "success" | "rate_limited" | "auth_failed" | "server_error"
): LLMClient {
  const successResponse: LLMResponse = {
    content: "test response",
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
  };

  const chat = vi.fn(async () => {
    if (behavior === "success") {
      return successResponse;
    }
    if (behavior === "rate_limited") {
      throw new LLMError("RATE_LIMITED", "test-provider", true, "Rate limited");
    }
    if (behavior === "auth_failed") {
      throw new LLMError("AUTH_FAILED", "test-provider", false, "Auth failed");
    }
    if (behavior === "server_error") {
      throw new LLMError("SERVER_ERROR", "test-provider", true, "Server error");
    }
    throw new Error("Unknown behavior");
  });

  const chatStream = vi.fn(async function* () {
    if (behavior === "success") {
      yield { content: "test", done: false };
      yield { content: " stream", done: true, usage: successResponse.usage };
      return;
    }
    if (behavior === "rate_limited") {
      throw new LLMError("RATE_LIMITED", "test-provider", true, "Rate limited");
    }
    if (behavior === "auth_failed") {
      throw new LLMError("AUTH_FAILED", "test-provider", false, "Auth failed");
    }
    if (behavior === "server_error") {
      throw new LLMError("SERVER_ERROR", "test-provider", true, "Server error");
    }
    throw new Error("Unknown behavior");
  });

  const extractUsage = vi.fn(() => successResponse.usage);

  return { chat, chatStream, extractUsage } as LLMClient;
}

describe("FallbackLLMClient", () => {
  const mockRequest: LLMRequest = {
    model: "test-model",
    messages: [{ role: "user", content: "test" }],
  };

  describe("chat", () => {
    it("should return primary response when primary succeeds", async () => {
      const primary = createMockClient("success");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const response = await client.chat(mockRequest);

      expect(response.content).toBe("test response");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).not.toHaveBeenCalled();
    });

    it("should fallback when primary is rate limited", async () => {
      const primary = createMockClient("rate_limited");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const response = await client.chat(mockRequest);

      expect(response.content).toBe("test response");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).toHaveBeenCalledTimes(1);
    });

    it("should fallback when primary has server error", async () => {
      const primary = createMockClient("server_error");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const response = await client.chat(mockRequest);

      expect(response.content).toBe("test response");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).toHaveBeenCalledTimes(1);
    });

    it("should NOT fallback when primary has auth error (non-retryable)", async () => {
      const primary = createMockClient("auth_failed");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      await expect(client.chat(mockRequest)).rejects.toThrow("Auth failed");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).not.toHaveBeenCalled();
    });

    it("should try multiple fallbacks in order", async () => {
      const primary = createMockClient("rate_limited");
      const fallback1 = createMockClient("rate_limited");
      const fallback2 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1, fallback2]);

      const response = await client.chat(mockRequest);

      expect(response.content).toBe("test response");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).toHaveBeenCalledTimes(1);
      expect(fallback2.chat).toHaveBeenCalledTimes(1);
    });

    it("should throw last error when all engines fail", async () => {
      const primary = createMockClient("rate_limited");
      const fallback1 = createMockClient("rate_limited");
      const fallback2 = createMockClient("rate_limited");
      const client = new FallbackLLMClient(primary, [fallback1, fallback2]);

      await expect(client.chat(mockRequest)).rejects.toThrow("Rate limited");
      expect(primary.chat).toHaveBeenCalledTimes(1);
      expect(fallback1.chat).toHaveBeenCalledTimes(1);
      expect(fallback2.chat).toHaveBeenCalledTimes(1);
    });
  });

  describe("chatStream", () => {
    it("should return primary stream when primary succeeds", async () => {
      const primary = createMockClient("success");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of client.chatStream(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe("test");
      expect(chunks[1].content).toBe(" stream");
      expect(primary.chatStream).toHaveBeenCalledTimes(1);
      expect(fallback1.chatStream).not.toHaveBeenCalled();
    });

    it("should fallback stream when primary is rate limited", async () => {
      const primary = createMockClient("rate_limited");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of client.chatStream(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(primary.chatStream).toHaveBeenCalledTimes(1);
      expect(fallback1.chatStream).toHaveBeenCalledTimes(1);
    });

    it("should NOT fallback stream when primary has auth error", async () => {
      const primary = createMockClient("auth_failed");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const collectChunks = async () => {
        const chunks: LLMStreamChunk[] = [];
        for await (const chunk of client.chatStream(mockRequest)) {
          chunks.push(chunk);
        }
        return chunks;
      };

      await expect(collectChunks()).rejects.toThrow("Auth failed");
      expect(primary.chatStream).toHaveBeenCalledTimes(1);
      expect(fallback1.chatStream).not.toHaveBeenCalled();
    });

    it("should try multiple fallback streams in order", async () => {
      const primary = createMockClient("rate_limited");
      const fallback1 = createMockClient("server_error");
      const fallback2 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1, fallback2]);

      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of client.chatStream(mockRequest)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(primary.chatStream).toHaveBeenCalledTimes(1);
      expect(fallback1.chatStream).toHaveBeenCalledTimes(1);
      expect(fallback2.chatStream).toHaveBeenCalledTimes(1);
    });
  });

  describe("extractUsage", () => {
    it("should delegate to primary client", () => {
      const primary = createMockClient("success");
      const fallback1 = createMockClient("success");
      const client = new FallbackLLMClient(primary, [fallback1]);

      const rawResponse = { usage: { input: 10, output: 20 } };
      const usage = client.extractUsage(rawResponse);

      expect(usage.inputTokens).toBe(10);
      expect(usage.outputTokens).toBe(20);
      expect(usage.totalTokens).toBe(30);
      expect(primary.extractUsage).toHaveBeenCalledWith(rawResponse);
    });
  });
});
