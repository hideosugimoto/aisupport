import { GoogleGenAI } from "@google/genai";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "./types";
import { LLMError } from "./errors";

export class GeminiClient implements LLMClient {
  private ai: GoogleGenAI;

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({
      apiKey: apiKey ?? process.env.GOOGLE_AI_API_KEY,
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      const systemInstruction = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");

      const contents = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: m.content }],
        }));

      const response = await this.ai.models.generateContent({
        model: request.model,
        contents,
        config: {
          systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      });

      const content = response.text ?? "";
      const usage = this.extractUsage(response);

      return { content, usage };
    } catch (error) {
      throw this.convertError(error);
    }
  }

  async *chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    try {
      const systemInstruction = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");

      const contents = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? ("model" as const) : ("user" as const),
          parts: [{ text: m.content }],
        }));

      const response = await this.ai.models.generateContentStream({
        model: request.model,
        contents,
        config: {
          systemInstruction,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text ?? "";
        const done = chunk.candidates?.[0]?.finishReason != null;

        const streamChunk: LLMStreamChunk = { content: text, done };

        if (chunk.usageMetadata) {
          streamChunk.usage = {
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
          };
        }

        yield streamChunk;
      }
    } catch (error) {
      throw this.convertError(error);
    }
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    const response = rawResponse as {
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    return {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    };
  }

  private convertError(error: unknown): LLMError {
    if (error instanceof Error) {
      const message = error.message;

      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        return new LLMError("RATE_LIMITED", "gemini", true, message);
      }
      if (
        message.includes("401") ||
        message.includes("403") ||
        message.includes("PERMISSION_DENIED") ||
        message.includes("API key")
      ) {
        return new LLMError("AUTH_FAILED", "gemini", false, message);
      }
      if (message.includes("500") || message.includes("INTERNAL")) {
        return new LLMError("SERVER_ERROR", "gemini", true, message);
      }
      if (
        message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") ||
        message.includes("fetch failed")
      ) {
        return new LLMError("NETWORK_ERROR", "gemini", false, message);
      }
      return new LLMError("UNKNOWN", "gemini", false, message);
    }

    return new LLMError("UNKNOWN", "gemini", false, String(error));
  }
}
