import { describe, it, expect, beforeEach } from "vitest";
import { loadPricing, clearPricingCache } from "@/lib/cost/pricing";

describe("pricing deep freeze", () => {
  beforeEach(() => {
    clearPricingCache();
  });

  it("should not allow mutation of top-level properties", () => {
    const pricing = loadPricing();
    expect(() => {
      (pricing as Record<string, unknown>).currency = "EUR";
    }).toThrow();
  });

  it("should not allow mutation of nested provider models", () => {
    const pricing = loadPricing();
    const openaiModels = pricing.providers["openai"];
    if (openaiModels) {
      expect(() => {
        (openaiModels as Record<string, unknown>)["new-model"] = { inputPer1m: 0, outputPer1m: 0 };
      }).toThrow();
    }
  });

  it("should not allow mutation of individual model pricing", () => {
    const pricing = loadPricing();
    const openaiModels = pricing.providers["openai"];
    if (openaiModels) {
      const firstModel = Object.keys(openaiModels)[0];
      if (firstModel) {
        expect(() => {
          (openaiModels[firstModel] as unknown as Record<string, unknown>).inputPer1m = 999;
        }).toThrow();
      }
    }
  });
});
