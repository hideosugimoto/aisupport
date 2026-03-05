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

function createBaseClient(provider: LLMProvider, apiKey?: string): LLMClient {
  switch (provider) {
    case "openai":
      return new OpenAIClient(apiKey);
    case "gemini":
      return new GeminiClient(apiKey);
    case "claude":
      return new ClaudeClient(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

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
  const wrappedClient = new LLMClientWrapper(createBaseClient(provider, apiKey), config);

  if (enableFallback) {
    const fallbackProviders = featuresConfig.enabled_providers.filter(
      (p) => p !== provider
    ) as LLMProvider[];

    const fallbackClients = fallbackProviders.map((p) =>
      new LLMClientWrapper(createBaseClient(p), config)
    );

    return new FallbackLLMClient(wrappedClient, fallbackClients);
  }

  return wrappedClient;
}
