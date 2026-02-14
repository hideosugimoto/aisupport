import type { LLMClient, LLMProvider } from "./types";
import { LLMClientWrapper, type RetryConfig } from "./client-wrapper";
import { OpenAIClient } from "./openai-client";
import { GeminiClient } from "./gemini-client";
import { ClaudeClient } from "./claude-client";
import { FallbackLLMClient } from "./fallback-client";
import { E2EMockClient } from "./e2e-mock-client";
import featuresConfig from "../../../config/features.json";

const defaultRetryConfig: RetryConfig = {
  maxRetries: featuresConfig.max_retry_count,
  timeoutMs: featuresConfig.default_timeout_ms,
};

export function createLLMClient(
  provider: LLMProvider,
  retryConfig?: RetryConfig,
  enableFallback = false,
  apiKey?: string
): LLMClient {
  // E2E_MOCK mode: return mock client for testing (disabled in production)
  if (process.env.E2E_MOCK === "true" && process.env.NODE_ENV !== "production") {
    return new E2EMockClient();
  }

  const config = retryConfig ?? defaultRetryConfig;
  let client: LLMClient;

  switch (provider) {
    case "openai":
      client = new OpenAIClient(apiKey);
      break;
    case "gemini":
      client = new GeminiClient(apiKey);
      break;
    case "claude":
      client = new ClaudeClient(apiKey);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const wrappedClient = new LLMClientWrapper(client, config);

  if (enableFallback) {
    // フォールバック順序: primary以外のプロバイダーを順番に試行
    const fallbackProviders = featuresConfig.enabled_providers.filter(
      (p) => p !== provider
    ) as LLMProvider[];

    const fallbackClients = fallbackProviders.map((p) => {
      let fallbackClient: LLMClient;
      switch (p) {
        case "openai":
          fallbackClient = new OpenAIClient();
          break;
        case "gemini":
          fallbackClient = new GeminiClient();
          break;
        case "claude":
          fallbackClient = new ClaudeClient();
          break;
        default:
          throw new Error(`Unknown provider: ${p}`);
      }
      return new LLMClientWrapper(fallbackClient, config);
    });

    return new FallbackLLMClient(wrappedClient, fallbackClients);
  }

  return wrappedClient;
}
