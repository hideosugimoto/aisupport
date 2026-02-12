import { describe, it, expect } from "vitest";
import { validateBreakdownInput } from "@/lib/validation/task-breakdown-input";

describe("validateBreakdownInput", () => {
  it("should pass with valid input", () => {
    const result = validateBreakdownInput({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when task is empty", () => {
    const result = validateBreakdownInput({
      task: "",
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("タスクを入力してください");
  });

  it("should fail when task exceeds 200 chars", () => {
    const result = validateBreakdownInput({
      task: "a".repeat(201),
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when availableTime is out of range", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 0,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when energyLevel is out of range", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 6,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when provider is invalid", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
      provider: "invalid",
    });
    expect(result.valid).toBe(false);
  });
});
