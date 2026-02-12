import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultWeeklyReviewEngine } from "../../../src/lib/strategy/weekly-review";
import type { LLMClient, LLMResponse, TokenUsage } from "../../../src/lib/llm/types";
import type { TaskDecisionRepository, TaskDecisionRecord } from "../../../src/lib/db/types";

class MockLLMClient implements LLMClient {
  public lastRequest: any = null;

  constructor(private mockResponse: LLMResponse) {}

  async chat(request: any): Promise<LLMResponse> {
    this.lastRequest = request;
    return this.mockResponse;
  }

  async *chatStream(): AsyncIterable<any> {
    yield { content: "", done: false };
  }

  extractUsage(rawResponse: unknown): TokenUsage {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}

class MockRepository implements TaskDecisionRepository {
  constructor(private mockDecisions: TaskDecisionRecord[]) {}

  async findByDateRange(from: Date, to: Date): Promise<TaskDecisionRecord[]> {
    return this.mockDecisions;
  }

  async save(): Promise<void> {}
  async findAll(): Promise<TaskDecisionRecord[]> {
    return [];
  }
  async search(): Promise<TaskDecisionRecord[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
  async countBySearch(): Promise<number> {
    return 0;
  }
}

describe("DefaultWeeklyReviewEngine", () => {
  const mockUsage: TokenUsage = {
    inputTokens: 500,
    outputTokens: 300,
    totalTokens: 800,
  };

  const mockDecisions: TaskDecisionRecord[] = [
    {
      id: 1,
      tasksInput: JSON.stringify(["タスクA", "タスクB"]),
      energyLevel: 4,
      availableTime: 60,
      provider: "openai",
      model: "gpt-4o-mini",
      result: "### 今日の最適タスク\nタスクA\n\n### 選定理由\nエネルギーが高い",
      createdAt: new Date("2026-02-10"),
    },
    {
      id: 2,
      tasksInput: JSON.stringify(["タスクC"]),
      energyLevel: 2,
      availableTime: 30,
      provider: "claude",
      model: "claude-3-5-sonnet-20241022",
      result: "### 今日の最適タスク\nタスクC\n\n### 選定理由\n短時間で完了可能",
      createdAt: new Date("2026-02-11"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("正常ケース: 履歴ありでレビュー生成", async () => {
    const mockResponse: LLMResponse = {
      content: "## 判定傾向\n高エネルギー時に長めのタスクを選択",
      usage: mockUsage,
      requestId: "test-req-1",
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const result = await engine.generateReview("openai");

    expect(result.review).toBe("## 判定傾向\n高エネルギー時に長めのタスクを選択");
    expect(result.decisionsCount).toBe(2);
    expect(result.usage).toEqual(mockUsage);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.periodStart).toBeInstanceOf(Date);
    expect(result.periodEnd).toBeInstanceOf(Date);
  });

  it("空の履歴ケース", async () => {
    const mockResponse: LLMResponse = {
      content: "## 判定傾向\n履歴がありません",
      usage: mockUsage,
      requestId: "test-req-2",
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository([]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const result = await engine.generateReview("gemini");

    expect(result.decisionsCount).toBe(0);
    expect(result.review).toContain("履歴がありません");
    expect(client.lastRequest.messages).toHaveLength(2);
    expect(client.lastRequest.messages[0].role).toBe("system");
    expect(client.lastRequest.messages[1].role).toBe("user");
    expect(client.lastRequest.messages[1].content).toContain("この期間に判定履歴はありません");
  });

  it("LLMエラーケース", async () => {
    const errorClient: LLMClient = {
      async chat() {
        throw new Error("API Error");
      },
      async *chatStream() {
        yield { content: "", done: false };
      },
      extractUsage() {
        return mockUsage;
      },
    };

    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(errorClient, repo);

    await expect(engine.generateReview()).rejects.toThrow("API Error");
  });

  it("プロンプトに期間と件数が含まれる", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー結果",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    await engine.generateReview();

    expect(client.lastRequest.messages[1].content).toContain("合計 2 件");
    expect(client.lastRequest.messages[1].content).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("プロバイダー別のモデル選択（config/features.json から取得）", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository([]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    await engine.generateReview("claude");
    expect(client.lastRequest.model).toBe("claude-sonnet-4-20250514");

    await engine.generateReview("gemini");
    expect(client.lastRequest.model).toBe("gemini-2.0-flash");

    await engine.generateReview("openai");
    expect(client.lastRequest.model).toBe("gpt-4o-mini");
  });

  it("コスト計算が正しい", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー",
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository([]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const result = await engine.generateReview("openai");
    // OpenAI: input $0.15/M, output $0.6/M
    // (1000/1M * 0.15) + (500/1M * 0.6) = 0.00015 + 0.0003 = 0.00045
    expect(result.costUsd).toBeCloseTo(0.00045, 5);
  });

  it("Geminiコスト計算（pricing.jsonから取得）", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー",
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository([]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const result = await engine.generateReview("gemini");
    // Gemini (gemini-2.0-flash): input $0.10/M, output $0.40/M
    // (1000/1M * 0.10) + (500/1M * 0.40) = 0.0001 + 0.0002 = 0.0003
    expect(result.costUsd).toBeCloseTo(0.0003, 5);
  });

  it("決定履歴のフォーマットが正しい", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    await engine.generateReview();

    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("タスクA");
    expect(userPrompt).toContain("タスクB");
    expect(userPrompt).toContain("エネルギー: 4/5");
    expect(userPrompt).toContain("利用可能時間: 60分");
    expect(userPrompt).toContain("openai");
  });
});
