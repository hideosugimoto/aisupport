import { describe, it, expect, vi } from "vitest";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import { MockLLMClient } from "@/lib/llm/mock-client";
import { validateTaskInput } from "@/lib/validation/task-input";
import type { UsageLogRepository } from "@/lib/db/types";
import { LLMError } from "@/lib/llm/errors";

function createMockRepository(): UsageLogRepository & {
  savedLogs: Array<Record<string, unknown>>;
} {
  const savedLogs: Array<Record<string, unknown>> = [];
  return {
    savedLogs,
    save: vi.fn(async (log) => {
      savedLogs.push(log);
    }),
    findByMonth: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([]),
    aggregateByProvider: vi.fn().mockResolvedValue([]),
  };
}

describe("Decision Flow Integration", () => {
  it("should complete full flow: input → validation → LLM → result → log", async () => {
    // 1. バリデーション
    const input = {
      tasks: ["プログラミング学習", "メール返信", "企画書作成"],
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    };
    const validation = validateTaskInput(input);
    expect(validation.valid).toBe(true);

    // 2. MockLLMClientでDecision Engine実行
    const mockClient = new MockLLMClient(
      "### 今日の最適タスク\nプログラミング学習\n\n### 選定理由\n将来収入インパクトが最も高い\n\n### 最初の5分行動\nエディタを開いてチュートリアルの続きを始める"
    );
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(mockClient, repo, "openai");

    const result = await engine.decide({
      tasks: input.tasks,
      availableTime: input.availableTime,
      energyLevel: input.energyLevel,
    });

    // 3. 結果検証
    expect(result.content).toContain("プログラミング学習");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.isAnxietyMode).toBe(false);

    // 4. ログ記録検証
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.savedLogs[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4o-mini",
      feature: "task_decision",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it("should activate anxiety mode when energy <= 2", async () => {
    const input = {
      tasks: ["タスクA", "タスクB"],
      availableTime: 30,
      energyLevel: 1,
      provider: "openai",
    };
    const validation = validateTaskInput(input);
    expect(validation.valid).toBe(true);

    const mockClient = new MockLLMClient("低エネルギーモードの結果");
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(mockClient, repo, "openai");

    const result = await engine.decide({
      tasks: input.tasks,
      availableTime: input.availableTime,
      energyLevel: input.energyLevel,
    });

    expect(result.isAnxietyMode).toBe(true);

    // プロンプトに不安モード指示が含まれていることを確認
    const systemMessage = mockClient.lastRequest?.messages.find(
      (m) => m.role === "system"
    );
    expect(systemMessage?.content).toContain("低エネルギーモード");
  });

  it("should activate anxiety mode when energy = 2", async () => {
    const mockClient = new MockLLMClient("結果");
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(mockClient, repo, "openai");

    const result = await engine.decide({
      tasks: ["タスク"],
      availableTime: 15,
      energyLevel: 2,
    });

    expect(result.isAnxietyMode).toBe(true);

    const systemMessage = mockClient.lastRequest?.messages.find(
      (m) => m.role === "system"
    );
    expect(systemMessage?.content).toContain("低エネルギーモード");
  });

  it("should NOT activate anxiety mode when energy = 3", async () => {
    const mockClient = new MockLLMClient("結果");
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(mockClient, repo, "openai");

    const result = await engine.decide({
      tasks: ["タスク"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(result.isAnxietyMode).toBe(false);

    const systemMessage = mockClient.lastRequest?.messages.find(
      (m) => m.role === "system"
    );
    expect(systemMessage?.content).not.toContain("低エネルギーモード");
  });

  it("should propagate LLMError correctly", async () => {
    const mockClient = new MockLLMClient("", {
      errorOnCall: { code: "AUTH_FAILED", message: "Invalid API key" },
    });
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(mockClient, repo, "openai");

    await expect(
      engine.decide({
        tasks: ["タスク"],
        availableTime: 60,
        energyLevel: 3,
      })
    ).rejects.toThrow(LLMError);

    await expect(
      engine.decide({
        tasks: ["タスク"],
        availableTime: 60,
        energyLevel: 3,
      })
    ).rejects.toMatchObject({
      code: "AUTH_FAILED",
      provider: "mock",
    });

    // エラー時はログ記録されない
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("should reject invalid input before calling LLM", () => {
    const validation = validateTaskInput({
      tasks: [],
      availableTime: 0,
      energyLevel: 0,
      provider: "invalid",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThanOrEqual(4);
  });
});
