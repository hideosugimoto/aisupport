import { describe, it, expect } from "vitest";
import { validateTaskInput, type TaskInput } from "@/lib/validation/task-input";

describe("validateTaskInput", () => {
  const validInput: TaskInput = {
    tasks: ["タスクA", "タスクB"],
    availableTime: 60,
    energyLevel: 3,
    provider: "openai",
  };

  it("should pass with valid input", () => {
    const result = validateTaskInput(validInput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // タスク候補バリデーション
  it("should fail when tasks is empty", () => {
    const result = validateTaskInput({ ...validInput, tasks: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("タスクを1つ以上入力してください");
  });

  it("should fail when a task is empty string", () => {
    const result = validateTaskInput({ ...validInput, tasks: ["タスクA", ""] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("タスクを1つ以上入力してください");
  });

  it("should fail when a task is whitespace only", () => {
    const result = validateTaskInput({ ...validInput, tasks: ["  "] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("タスクを1つ以上入力してください");
  });

  // 利用可能時間バリデーション
  it("should fail when availableTime is 0", () => {
    const result = validateTaskInput({ ...validInput, availableTime: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("利用可能時間を正しく入力してください");
  });

  it("should fail when availableTime exceeds 1440", () => {
    const result = validateTaskInput({ ...validInput, availableTime: 1441 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("利用可能時間を正しく入力してください");
  });

  it("should fail when availableTime is not integer", () => {
    const result = validateTaskInput({ ...validInput, availableTime: 30.5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("利用可能時間を正しく入力してください");
  });

  it("should pass when availableTime is 1", () => {
    const result = validateTaskInput({ ...validInput, availableTime: 1 });
    expect(result.valid).toBe(true);
  });

  it("should pass when availableTime is 1440", () => {
    const result = validateTaskInput({ ...validInput, availableTime: 1440 });
    expect(result.valid).toBe(true);
  });

  // エネルギー状態バリデーション
  it("should fail when energyLevel is 0", () => {
    const result = validateTaskInput({ ...validInput, energyLevel: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("1〜5の範囲で選択してください");
  });

  it("should fail when energyLevel is 6", () => {
    const result = validateTaskInput({ ...validInput, energyLevel: 6 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("1〜5の範囲で選択してください");
  });

  it("should fail when energyLevel is not integer", () => {
    const result = validateTaskInput({ ...validInput, energyLevel: 2.5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("1〜5の範囲で選択してください");
  });

  // エンジン選択バリデーション
  it("should fail with invalid provider", () => {
    const result = validateTaskInput({ ...validInput, provider: "claude" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("エンジンを選択してください");
  });

  it("should pass with gemini provider", () => {
    const result = validateTaskInput({ ...validInput, provider: "gemini" });
    expect(result.valid).toBe(true);
  });

  // 複数エラー
  it("should return multiple errors", () => {
    const result = validateTaskInput({
      tasks: [],
      availableTime: 0,
      energyLevel: 0,
      provider: "invalid",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
