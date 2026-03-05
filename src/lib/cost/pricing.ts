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

// Lazy singleton — built once, frozen, never reassigned
let cachedPricing: Readonly<PricingInfo> | null = null;

function buildPricing(): Readonly<PricingInfo> {
  const providers: Record<string, Record<string, ModelPricing>> = {};

  for (const [provider, models] of Object.entries(pricingConfig.providers)) {
    const modelMap: Record<string, ModelPricing> = {};
    for (const [model, pricing] of Object.entries(
      models as Record<string, { input_per_1m: number; output_per_1m: number }>
    )) {
      modelMap[model] = Object.freeze({
        inputPer1m: pricing.input_per_1m,
        outputPer1m: pricing.output_per_1m,
      });
    }
    providers[provider] = Object.freeze(modelMap);
  }

  return Object.freeze({
    currency: pricingConfig.currency,
    exchangeRateJpy: pricingConfig.exchange_rate_jpy,
    providers: Object.freeze(providers),
  });
}

export function loadPricing(): Readonly<PricingInfo> {
  if (!cachedPricing) {
    cachedPricing = buildPricing();
  }
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
