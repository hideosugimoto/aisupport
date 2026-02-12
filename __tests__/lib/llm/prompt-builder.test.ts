import { describe, it, expect } from "vitest";
import { buildTaskDecisionMessages } from "@/lib/llm/prompt-builder";

describe("buildTaskDecisionMessages", () => {
  it("should build system and user messages", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["タスクA", "タスクB"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("should include evaluation axes in system prompt", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["タスクA"],
      availableTime: 30,
      energyLevel: 4,
    });

    expect(messages[0].content).toContain("自由度向上");
    expect(messages[0].content).toContain("将来収入インパクト");
  });

  it("should include tasks in user prompt", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["コード書く", "メール返信"],
      availableTime: 120,
      energyLevel: 3,
    });

    expect(messages[1].content).toContain("コード書く");
    expect(messages[1].content).toContain("メール返信");
    expect(messages[1].content).toContain("120分");
  });

  it("should include anxiety mode instructions when energy <= 2", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["タスクA"],
      availableTime: 30,
      energyLevel: 2,
    });

    expect(messages[0].content).toContain("低エネルギーモード");
    expect(messages[0].content).toContain("状態の構造分析");
  });

  it("should include anxiety mode instructions when energy = 1", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["タスクA"],
      availableTime: 15,
      energyLevel: 1,
    });

    expect(messages[0].content).toContain("低エネルギーモード");
  });

  it("should NOT include anxiety mode when energy = 3", () => {
    const messages = buildTaskDecisionMessages({
      tasks: ["タスクA"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages[0].content).not.toContain("低エネルギーモード");
  });
});
