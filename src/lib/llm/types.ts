export type LLMProvider = "openai" | "gemini" | "claude";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  requestId?: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
}

export interface LLMClient {
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  extractUsage(rawResponse: unknown): TokenUsage;
}
