import { describe, it, expect } from "vitest";
import { buildTaskBreakdownMessages } from "@/lib/llm/prompt-builder";

describe("buildTaskBreakdownMessages", () => {
  it("should build system and user messages", () => {
    const messages = buildTaskBreakdownMessages({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("should include task in user prompt", () => {
    const messages = buildTaskBreakdownMessages({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages[1].content).toContain("確定申告の準備");
    expect(messages[1].content).toContain("60分");
  });

  it("should include breakdown instructions in system prompt", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 30,
      energyLevel: 4,
    });

    expect(messages[0].content).toContain("タスク分解の専門家");
    expect(messages[0].content).toContain("サブタスク");
  });

  it("should include anxiety mode when energy <= 2", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 30,
      energyLevel: 2,
    });

    expect(messages[0].content).toContain("低エネルギーモード");
    expect(messages[0].content).toContain("5〜10分");
  });

  it("should NOT include anxiety mode when energy = 3", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages[0].content).not.toContain("低エネルギーモード");
  });
});
