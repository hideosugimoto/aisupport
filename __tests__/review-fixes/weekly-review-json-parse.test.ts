import { describe, it, expect, vi } from "vitest";
import { DefaultWeeklyReviewEngine } from "../../src/lib/strategy/weekly-review";
import type { LLMClient, LLMResponse, TokenUsage } from "../../src/lib/llm/types";
import type { TaskDecisionRepository, TaskDecisionRecord } from "../../src/lib/db/types";

/**
 * H8: weekly-review の formatDecisionsSummary で JSON.parse が try/catch なし
 * 不正な tasksInput で例外ではなくgraceful degradation すべき
 */

class MockLLMClient implements LLMClient {
  public lastRequest: any = null;

  async chat(request: any): Promise<LLMResponse> {
    this.lastRequest = request;
    return {
      content: "レビュー結果",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
  }

  async *chatStream(): AsyncIterable<any> {
    yield { content: "", done: false };
  }

  extractUsage(): TokenUsage {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}

class MockRepository implements TaskDecisionRepository {
  constructor(private mockDecisions: TaskDecisionRecord[]) {}
  async findByDateRange(): Promise<TaskDecisionRecord[]> {
    return this.mockDecisions;
  }
  async save(): Promise<void> {}
  async findAll(): Promise<TaskDecisionRecord[]> { return []; }
  async search(): Promise<TaskDecisionRecord[]> { return []; }
  async count(): Promise<number> { return 0; }
  async countBySearch(): Promise<number> { return 0; }
}

describe("H8: weekly-review JSON.parse safety", () => {
  it("should not throw when tasksInput is invalid JSON", async () => {
    const brokenDecision: TaskDecisionRecord = {
      id: 1,
      tasksInput: "NOT VALID JSON {{{",
      energyLevel: 3,
      availableTime: 60,
      provider: "openai",
      model: "gpt-4o-mini",
      result: "テスト結果",
      createdAt: new Date("2026-03-01"),
    };

    const client = new MockLLMClient();
    const repo = new MockRepository([brokenDecision]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    // Should NOT throw — should handle gracefully
    const result = await engine.generateReview("test-user", "openai");
    expect(result.review).toBe("レビュー結果");
    expect(result.decisionsCount).toBe(1);
  });

  it("should handle mix of valid and invalid tasksInput", async () => {
    const decisions: TaskDecisionRecord[] = [
      {
        id: 1,
        tasksInput: JSON.stringify(["タスクA"]),
        energyLevel: 3,
        availableTime: 60,
        provider: "openai",
        model: "gpt-4o-mini",
        result: "結果A",
        createdAt: new Date("2026-03-01"),
      },
      {
        id: 2,
        tasksInput: "broken",
        energyLevel: 2,
        availableTime: 30,
        provider: "openai",
        model: "gpt-4o-mini",
        result: "結果B",
        createdAt: new Date("2026-03-02"),
      },
    ];

    const client = new MockLLMClient();
    const repo = new MockRepository(decisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const result = await engine.generateReview("test-user", "openai");
    expect(result.decisionsCount).toBe(2);

    // Valid task should appear in prompt
    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("タスクA");
  });
});
