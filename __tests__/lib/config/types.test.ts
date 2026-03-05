import { describe, it, expect } from "vitest";
import { getDefaultModel, getAvailableModels } from "@/lib/config/types";

describe("getDefaultModel", () => {
  it("should return model for known provider", () => {
    const model = getDefaultModel("openai");
    expect(model).toBeTruthy();
    expect(typeof model).toBe("string");
  });

  it("should throw for unknown provider", () => {
    expect(() => getDefaultModel("nonexistent")).toThrow("Unknown provider");
  });
});

describe("getAvailableModels", () => {
  it("should return array for known provider", () => {
    const models = getAvailableModels("openai");
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("should return empty array for unknown provider", () => {
    const models = getAvailableModels("nonexistent");
    expect(models).toEqual([]);
  });
});
