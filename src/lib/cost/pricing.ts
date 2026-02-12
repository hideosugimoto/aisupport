import pricingConfig from "../../../config/pricing.json";

export interface ModelPricing {
  inputPer1m: number;
  outputPer1m: number;
}

export interface PricingInfo {
  currency: string;
  exchangeRateJpy: number;
  providers: Record<string, Record<string, ModelPricing>>;
}

// Module-level cache
let cachedPricing: PricingInfo | null = null;

export function loadPricing(): PricingInfo {
  // Return cached value if available
  if (cachedPricing) {
    return cachedPricing;
  }
  const providers: Record<string, Record<string, ModelPricing>> = {};

  for (const [provider, models] of Object.entries(pricingConfig.providers)) {
    providers[provider] = {};
    for (const [model, pricing] of Object.entries(
      models as Record<string, { input_per_1m: number; output_per_1m: number }>
    )) {
      providers[provider][model] = {
        inputPer1m: pricing.input_per_1m,
        outputPer1m: pricing.output_per_1m,
      };
    }
  }

  // Cache the parsed result
  cachedPricing = {
    currency: pricingConfig.currency,
    exchangeRateJpy: pricingConfig.exchange_rate_jpy,
    providers,
  };

  return cachedPricing;
}

export function calculateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = loadPricing();
  const modelPricing = pricing.providers[provider]?.[model];
  if (!modelPricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * modelPricing.inputPer1m;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.outputPer1m;
  return inputCost + outputCost;
}

export function usdToJpy(usd: number): number {
  const pricing = loadPricing();
  return usd * pricing.exchangeRateJpy;
}

/**
 * Clears the pricing cache. Mainly for testing purposes.
 */
export function clearPricingCache(): void {
  cachedPricing = null;
}
