import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultWeeklyReviewEngine } from "../../../src/lib/strategy/weekly-review";
import type { LLMClient, LLMResponse, TokenUsage } from "../../../src/lib/llm/types";
import type { TaskDecisionRepository, TaskDecisionRecord } from "../../../src/lib/db/types";
import type { Retriever, RetrievalResult } from "../../../src/lib/rag/retriever";
import type { NeglectDetector, NeglectedCompass } from "../../../src/lib/compass/neglect-detector";

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

  async findByDateRange(userId: string, from: Date, to: Date): Promise<TaskDecisionRecord[]> {
    return this.mockDecisions;
  }

  async save(): Promise<void> {}
  async findAll(userId: string): Promise<TaskDecisionRecord[]> {
    return [];
  }
  async search(userId: string): Promise<TaskDecisionRecord[]> {
    return [];
  }
  async count(userId: string): Promise<number> {
    return 0;
  }
  async countBySearch(userId: string): Promise<number> {
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

    const result = await engine.generateReview("test-user", "openai");

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

    const result = await engine.generateReview("test-user", "gemini");

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

    await expect(engine.generateReview("test-user")).rejects.toThrow("API Error");
  });

  it("プロンプトに期間と件数が含まれる", async () => {
    const mockResponse: LLMResponse = {
      content: "レビュー結果",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    await engine.generateReview("test-user");

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

    await engine.generateReview("test-user", "claude");
    expect(client.lastRequest.model).toBe("claude-sonnet-4-20250514");

    await engine.generateReview("test-user", "gemini");
    expect(client.lastRequest.model).toBe("gemini-2.0-flash");

    await engine.generateReview("test-user", "openai");
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

    const result = await engine.generateReview("test-user", "openai");
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

    const result = await engine.generateReview("test-user", "gemini");
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

    await engine.generateReview("test-user");

    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("タスクA");
    expect(userPrompt).toContain("タスクB");
    expect(userPrompt).toContain("エネルギー: 4/5");
    expect(userPrompt).toContain("利用可能時間: 60分");
    expect(userPrompt).toContain("openai");
  });
});

describe("DefaultWeeklyReviewEngine - Compass 統合", () => {
  const mockUsage: TokenUsage = {
    inputTokens: 500,
    outputTokens: 300,
    totalTokens: 800,
  };

  const mockDecisions: TaskDecisionRecord[] = [
    {
      id: 1,
      tasksInput: JSON.stringify(["起業準備", "営業資料作成"]),
      energyLevel: 4,
      availableTime: 120,
      provider: "openai",
      model: "gpt-4o-mini",
      result: "### 今日の最適タスク\n起業準備",
      createdAt: new Date("2026-03-25"),
    },
    {
      id: 2,
      tasksInput: JSON.stringify(["ジム", "読書"]),
      energyLevel: 3,
      availableTime: 60,
      provider: "openai",
      model: "gpt-4o-mini",
      result: "### 今日の最適タスク\nジム",
      createdAt: new Date("2026-03-27"),
    },
  ];

  function createMockRetriever(contextText: string, results: any[] = []): Retriever {
    return {
      retrieve: vi.fn<(userId: string, query: string, topK?: number) => Promise<RetrievalResult>>().mockResolvedValue({
        contextText,
        results,
      }),
      buildContextSection: vi.fn().mockReturnValue(contextText),
    };
  }

  function createMockNeglectDetector(result: NeglectedCompass | null): NeglectDetector {
    return {
      detect: vi.fn<(userId: string, taskQuery: string) => Promise<NeglectedCompass | null>>().mockResolvedValue(result),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Compass Retriever 設定時、プロンプトにマイゴールコンテキストが含まれる", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー\nマイゴールと整合しています",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const retriever = createMockRetriever(
      "[マイゴール1: 起業の夢 (関連度: 85%)]\n独立して自由に働く",
      [{ content: "独立して自由に働く", filename: "起業の夢", similarity: 0.85, chunkId: 1, documentId: 10 }]
    );
    engine.setCompassRetriever(retriever);

    const result = await engine.generateReview("test-user");

    expect(retriever.retrieve).toHaveBeenCalledWith(
      "test-user",
      expect.stringContaining("起業準備")
    );
    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("マイゴール（目標・価値観）との照合");
    expect(userPrompt).toContain("起業の夢");
    expect(result.compassContext).toBeDefined();
    expect(result.compassContext?.hasCompass).toBe(true);
  });

  it("NeglectDetector 設定時、neglected item がプロンプトに含まれる", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー\n健康目標が疎かです",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const detector = createMockNeglectDetector({
      compassItemId: 20,
      title: "健康目標",
      content: "毎週3回運動する",
      similarity: 0.15,
    });
    engine.setNeglectDetector(detector);

    const result = await engine.generateReview("test-user");

    expect(detector.detect).toHaveBeenCalledWith(
      "test-user",
      expect.stringContaining("起業準備")
    );
    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("今週あまり参照されなかったマイゴール項目");
    expect(userPrompt).toContain("健康目標");
    expect(userPrompt).toContain("15%");
    expect(result.compassContext?.neglectedItem).toEqual({
      title: "健康目標",
      similarity: 0.15,
    });
  });

  it("Compass Retriever と NeglectDetector の両方が設定されている場合", async () => {
    const mockResponse: LLMResponse = {
      content: "## 総合レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const retriever = createMockRetriever(
      "[マイゴール1: キャリア目標 (関連度: 90%)]\n年収1000万",
      [{ content: "年収1000万", filename: "キャリア目標", similarity: 0.9, chunkId: 1, documentId: 1 }]
    );
    const detector = createMockNeglectDetector({
      compassItemId: 5,
      title: "家族との時間",
      content: "週末は家族と過ごす",
      similarity: 0.1,
    });

    engine.setCompassRetriever(retriever);
    engine.setNeglectDetector(detector);

    const result = await engine.generateReview("test-user");

    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).toContain("マイゴール（目標・価値観）との照合");
    expect(userPrompt).toContain("キャリア目標");
    expect(userPrompt).toContain("今週あまり参照されなかったマイゴール項目");
    expect(userPrompt).toContain("家族との時間");
    expect(result.compassContext?.hasCompass).toBe(true);
    expect(result.compassContext?.neglectedItem?.title).toBe("家族との時間");
  });

  it("Compass Retriever が失敗しても generateReview は成功する（graceful degradation）", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー\n通常のレビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const failingRetriever: Retriever = {
      retrieve: vi.fn().mockRejectedValue(new Error("Embedding API error")),
      buildContextSection: vi.fn(),
    };
    engine.setCompassRetriever(failingRetriever);

    const result = await engine.generateReview("test-user");

    expect(result.review).toContain("通常のレビュー");
    expect(result.compassContext).toBeUndefined();
    expect(result.decisionsCount).toBe(2);
  });

  it("NeglectDetector が失敗しても generateReview は成功する", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const failingDetector: NeglectDetector = {
      detect: vi.fn().mockRejectedValue(new Error("DB connection error")),
    };
    engine.setNeglectDetector(failingDetector);

    const result = await engine.generateReview("test-user");

    expect(result.review).toBe("## レビュー");
    expect(result.compassContext).toBeUndefined();
  });

  it("判定履歴が空の場合、Compass クエリは実行されない", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー\n履歴なし",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository([]);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const retriever = createMockRetriever("コンテキスト");
    const detector = createMockNeglectDetector(null);
    engine.setCompassRetriever(retriever);
    engine.setNeglectDetector(detector);

    const result = await engine.generateReview("test-user");

    expect(retriever.retrieve).not.toHaveBeenCalled();
    expect(detector.detect).not.toHaveBeenCalled();
    expect(result.compassContext).toBeUndefined();
  });

  it("NeglectDetector が null を返した場合、neglectedItem は含まれない", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const retriever = createMockRetriever(
      "[マイゴール1: 目標 (関連度: 80%)]\nテスト",
      [{ content: "テスト", filename: "目標", similarity: 0.8, chunkId: 1, documentId: 1 }]
    );
    const detector = createMockNeglectDetector(null);
    engine.setCompassRetriever(retriever);
    engine.setNeglectDetector(detector);

    const result = await engine.generateReview("test-user");

    expect(result.compassContext?.hasCompass).toBe(true);
    expect(result.compassContext?.neglectedItem).toBeUndefined();
  });

  it("Compass Retriever が空のコンテキストを返した場合", async () => {
    const mockResponse: LLMResponse = {
      content: "## レビュー",
      usage: mockUsage,
    };

    const client = new MockLLMClient(mockResponse);
    const repo = new MockRepository(mockDecisions);
    const engine = new DefaultWeeklyReviewEngine(client, repo);

    const retriever = createMockRetriever("", []);
    engine.setCompassRetriever(retriever);

    const result = await engine.generateReview("test-user");

    const userPrompt = client.lastRequest.messages[1].content;
    expect(userPrompt).not.toContain("マイゴール（目標・価値観）との照合");
    expect(result.compassContext).toBeUndefined();
  });
});
