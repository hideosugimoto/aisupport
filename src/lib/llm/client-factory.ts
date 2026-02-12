import type { LLMClient, LLMProvider } from "./types";
import { LLMClientWrapper, type RetryConfig } from "./client-wrapper";
import { OpenAIClient } from "./openai-client";
import { GeminiClient } from "./gemini-client";
import featuresConfig from "../../../config/features.json";

const defaultRetryConfig: RetryConfig = {
  maxRetries: featuresConfig.max_retry_count,
  timeoutMs: featuresConfig.default_timeout_ms,
};

export function createLLMClient(
  provider: LLMProvider,
  retryConfig?: RetryConfig
): LLMClient {
  const config = retryConfig ?? defaultRetryConfig;
  let client: LLMClient;

  switch (provider) {
    case "openai":
      client = new OpenAIClient();
      break;
    case "gemini":
      client = new GeminiClient();
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return new LLMClientWrapper(client, config);
}
