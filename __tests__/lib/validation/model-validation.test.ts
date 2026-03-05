import { describe, it, expect } from "vitest";
import { isAllowedModel } from "@/lib/validation/model-validation";

describe("isAllowedModel", () => {
  it("should return true for valid openai model", () => {
    expect(isAllowedModel("openai", "gpt-4o-mini")).toBe(true);
  });

  it("should return false for invalid model", () => {
    expect(isAllowedModel("openai", "nonexistent-model")).toBe(false);
  });

  it("should return false for unknown provider", () => {
    expect(isAllowedModel("unknown-provider", "gpt-4o-mini")).toBe(false);
  });
});
