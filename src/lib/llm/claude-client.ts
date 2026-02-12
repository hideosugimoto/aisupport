import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError } from "./errors";

export class ClaudeClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Anthropic requires system messages to be passed separately
      const systemMessages = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");

      const messages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const response = await this.client.messages.create({
        model: request.model,
        system: systemMessages || undefined,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? 4096, // Claude requires max_tokens
      });

      const content = response.content[0]?.type === "text"
        ? response.content[0].text
        : "";
      const usage = this.extractUsage(response);

      return {
        content,
        usage,
        requestId: response.id,
      };
    } catch (error) {
      throw this.convertError(error);
    }
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    try {
      const systemMessages = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");

      const messages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const stream = await this.client.messages.stream({
        model: request.model,
        system: systemMessages || undefined,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? 4096,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            yield { content: delta.text, done: false };
          }
        } else if (event.type === "message_delta") {
          // Stream is ending, get final usage
          const finalMessage = await stream.finalMessage();
          const usage = this.extractUsage(finalMessage);
          yield { content: "", done: true, usage };
        }
      }
    } catch (error) {
      throw this.convertError(error);
    }
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    const response = rawResponse as {
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  private convertError(error: unknown): LLMError {
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status: number }).status;
      const message = (error as { message?: string }).message ?? String(error);

      if (status === 429) {
        return new LLMError("RATE_LIMITED", "claude", true, message);
      }
      if (status === 401 || status === 403) {
        return new LLMError("AUTH_FAILED", "claude", false, message);
      }
      if (status >= 500) {
        return new LLMError("SERVER_ERROR", "claude", true, message);
      }
      return new LLMError("UNKNOWN", "claude", false, message);
    }

    if (error instanceof Error) {
      const message = error.message;
      if (
        message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") ||
        message.includes("fetch failed")
      ) {
        return new LLMError("NETWORK_ERROR", "claude", false, message);
      }
      return new LLMError("UNKNOWN", "claude", false, message);
    }

    return new LLMError("UNKNOWN", "claude", false, String(error));
  }
}
