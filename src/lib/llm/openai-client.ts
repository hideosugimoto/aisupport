import OpenAI from "openai";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError } from "./errors";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      });

      const content = response.choices[0]?.message?.content ?? "";
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
      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? "";
        const done = chunk.choices[0]?.finish_reason !== null;

        const streamChunk: LLMStreamChunk = { content, done };

        if (chunk.usage) {
          streamChunk.usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          };
        }

        yield streamChunk;
      }
    } catch (error) {
      throw this.convertError(error);
    }
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    const response = rawResponse as OpenAI.Chat.Completions.ChatCompletion;
    return {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };
  }

  private convertError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      if (status === 429) {
        return new LLMError("RATE_LIMITED", "openai", true, error.message);
      }
      if (status === 401 || status === 403) {
        return new LLMError("AUTH_FAILED", "openai", false, error.message);
      }
      if (status !== undefined && status >= 500) {
        return new LLMError("SERVER_ERROR", "openai", true, error.message);
      }
      return new LLMError("UNKNOWN", "openai", false, error.message);
    }

    if (error instanceof Error) {
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("fetch failed")
      ) {
        return new LLMError("NETWORK_ERROR", "openai", false, error.message);
      }
      return new LLMError("UNKNOWN", "openai", false, error.message);
    }

    return new LLMError("UNKNOWN", "openai", false, String(error));
  }
}
