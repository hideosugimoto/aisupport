import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeClient } from "@/lib/llm/claude-client";
import { LLMError } from "@/lib/llm/errors";
import type { LLMRequest } from "@/lib/llm/types";

// Mock Anthropic SDK
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
    },
  };
});

describe("ClaudeClient", () => {
  let client: ClaudeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeClient("test-api-key");
  });

  describe("chat", () => {
    it("should return content and usage from API response", async () => {
      const mockResponse = {
        id: "msg_123",
        content: [{ type: "text", text: "Hello from Claude" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hello" }],
      };

      const result = await client.chat(request);

      expect(result.content).toBe("Hello from Claude");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.requestId).toBe("msg_123");
    });

    it("should separate system messages from user/assistant messages", async () => {
      const mockResponse = {
        id: "msg_456",
        content: [{ type: "text", text: "Response" }],
        usage: { input_tokens: 20, output_tokens: 10 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
        ],
      };

      await client.chat(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          system: "You are a helpful assistant",
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
            { role: "user", content: "How are you?" },
          ],
        })
      );
    });

    it("should handle multiple system messages by joining them", async () => {
      const mockResponse = {
        id: "msg_789",
        content: [{ type: "text", text: "Response" }],
        usage: { input_tokens: 15, output_tokens: 8 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "Rule 1" },
          { role: "system", content: "Rule 2" },
          { role: "user", content: "Hello" },
        ],
      };

      await client.chat(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Rule 1\nRule 2",
        })
      );
    });

    it("should pass temperature and max_tokens parameters", async () => {
      const mockResponse = {
        id: "msg_abc",
        content: [{ type: "text", text: "Response" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Test" }],
        temperature: 0.7,
        maxTokens: 2048,
      };

      await client.chat(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 2048,
        })
      );
    });

    it("should convert rate limit errors correctly", async () => {
      const error = {
        status: 429,
        message: "Rate limit exceeded",
      };

      mockCreate.mockRejectedValue(error);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Test" }],
      };

      await expect(client.chat(request)).rejects.toThrow(LLMError);
      await expect(client.chat(request)).rejects.toMatchObject({
        code: "RATE_LIMITED",
        provider: "claude",
        retryable: true,
      });
    });

    it("should convert auth errors correctly", async () => {
      const error = {
        status: 401,
        message: "Invalid API key",
      };

      mockCreate.mockRejectedValue(error);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Test" }],
      };

      await expect(client.chat(request)).rejects.toThrow(LLMError);
      await expect(client.chat(request)).rejects.toMatchObject({
        code: "AUTH_FAILED",
        provider: "claude",
        retryable: false,
      });
    });
  });

  describe("chatStream", () => {
    it("should yield content chunks and final usage", async () => {
      const mockStreamResponse = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
          };
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: " world" },
          };
          yield {
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
            usage: { output_tokens: 2 },
          };
        },
        finalMessage: () =>
          Promise.resolve({
            id: "msg_stream",
            usage: { input_tokens: 10, output_tokens: 2 },
          }),
      };

      mockStream.mockReturnValue(mockStreamResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      };

      const chunks: any[] = [];
      for await (const chunk of client.chatStream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ content: "Hello", done: false });
      expect(chunks[1]).toEqual({ content: " world", done: false });
      expect(chunks[2]).toEqual({
        content: "",
        done: true,
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      });
    });

    it("should handle stream errors correctly", async () => {
      const mockStreamResponse = {
        async *[Symbol.asyncIterator]() {
          throw { status: 500, message: "Server error" };
        },
      };

      mockStream.mockReturnValue(mockStreamResponse);

      const request: LLMRequest = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Test" }],
      };

      const stream = client.chatStream(request);
      const iterator = stream[Symbol.asyncIterator]();

      const result = iterator.next();
      await expect(result).rejects.toThrow(LLMError);
      await expect(result).rejects.toMatchObject({
        code: "SERVER_ERROR",
        provider: "claude",
      });
    });
  });

  describe("extractUsage", () => {
    it("should extract usage from raw response", () => {
      const rawResponse = {
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const usage = client.extractUsage(rawResponse);

      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
    });

    it("should return zero tokens if usage is missing", () => {
      const rawResponse = {};

      const usage = client.extractUsage(rawResponse);

      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
    });
  });
});
