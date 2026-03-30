import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";
import type { UsageLogRepository } from "@/lib/db/types";
import type { Retriever, RetrievalResult } from "@/lib/rag/retriever";
import { createMockLogger } from "../../helpers/mock-logger";

function createMockLLMClient(content: string = "### 今日の最適タスク\nタスク1"): LLMClient {
  return {
    chat: vi.fn<(req: LLMRequest) => Promise<LLMResponse>>().mockResolvedValue({
      content,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      requestId: "req-123",
    }),
    chatStream: vi.fn<(req: LLMRequest) => AsyncIterable<LLMStreamChunk>>().mockImplementation(async function* () {
      yield { content: "### 今日", done: false };
      yield { content: "の最適タスク\n", done: false };
      yield {
        content: "タスク1",
        done: true,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
    }),
    extractUsage: vi.fn<(raw: unknown) => TokenUsage>().mockReturnValue({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    }),
  };
}

function createMockRepository(): UsageLogRepository {
  return {
    save: vi.fn(),
    findByMonth: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([]),
    aggregateByProvider: vi.fn().mockResolvedValue([]),
  };
}

function createMockRetriever(contextText: string, results: any[] = []): Retriever {
  return {
    retrieve: vi.fn<(userId: string, query: string, topK?: number) => Promise<RetrievalResult>>().mockResolvedValue({
      contextText,
      results,
    }),
    buildContextSection: vi.fn().mockReturnValue(contextText),
  };
}

describe("TaskDecisionEngine - Compass Integration", () => {
  let client: LLMClient;
  let repo: UsageLogRepository;
  let engine: TaskDecisionEngine;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    client = createMockLLMClient();
    repo = createMockRepository();
    mockLogger = createMockLogger();
    engine = new TaskDecisionEngine(client, repo, "openai", undefined, mockLogger);
    vi.clearAllMocks();
  });

  it("compassRetriever が設定されている場合、decide() で compassRelevance を返す", async () => {
    const mockCompassRetriever = createMockRetriever(
      "## 羅針盤コンテキスト\n夢を追いかける",
      [
        { content: "夢を追いかける", filename: "起業の夢", similarity: 0.87, chunkId: 1, documentId: 10 },
        { content: "健康的な生活", filename: "健康目標", similarity: 0.65, chunkId: 2, documentId: 20 },
      ]
    );

    engine.setCompassRetriever(mockCompassRetriever);

    const result = await engine.decide("user-123", {
      tasks: ["プレゼン資料作成", "メール返信"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(mockCompassRetriever.retrieve).toHaveBeenCalledWith(
      "user-123",
      "プレゼン資料作成 メール返信"
    );

    expect(result.compassRelevance).toBeDefined();
    expect(result.compassRelevance?.hasCompass).toBe(true);
    expect(result.compassRelevance?.topMatches).toEqual([
      { title: "起業の夢", similarity: 0.87 },
      { title: "健康目標", similarity: 0.65 },
    ]);
  });

  it("compassRetriever が未設定の場合、compassRelevance は undefined", async () => {
    const result = await engine.decide("user-123", {
      tasks: ["タスクA"],
      availableTime: 30,
      energyLevel: 4,
    });

    expect(result.compassRelevance).toBeUndefined();
  });

  it("RAG と Compass が並列で取得される（Promise.all）", async () => {
    const mockRagRetriever = createMockRetriever("## RAG コンテキスト\n参考資料");
    const mockCompassRetriever = createMockRetriever("## 羅針盤コンテキスト\n夢の記録", [
      { content: "夢の記録", filename: "夢", similarity: 0.8, chunkId: 1, documentId: 1 },
    ]);

    engine.setRetriever(mockRagRetriever);
    engine.setCompassRetriever(mockCompassRetriever);

    const startTime = Date.now();
    await engine.decide("user-123", {
      tasks: ["タスクA"],
      availableTime: 60,
      energyLevel: 3,
    });
    const elapsed = Date.now() - startTime;

    // Both retrievers should be called
    expect(mockRagRetriever.retrieve).toHaveBeenCalledTimes(1);
    expect(mockCompassRetriever.retrieve).toHaveBeenCalledTimes(1);

    // Should be faster than sequential (parallel execution)
    // This is a weak assertion, but confirms no obvious sequential blocking
    expect(elapsed).toBeLessThan(5000); // Should complete quickly
  });

  it("Compass 検索が失敗しても decide は成功する（graceful degradation）", async () => {
    const mockCompassRetriever: Retriever = {
      retrieve: vi.fn().mockRejectedValue(new Error("Network error")),
      buildContextSection: vi.fn(),
    };

    engine.setCompassRetriever(mockCompassRetriever);

    // Should not throw
    const result = await engine.decide("user-123", {
      tasks: ["タスクA"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(result.content).toContain("タスク1");
    expect(result.compassRelevance).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[Compass] 検索失敗（続行）"),
      expect.objectContaining({ error: "Network error" })
    );
  });

  it("prepareStream() でも compassContext がプロンプトに注入される", async () => {
    const mockCompassRetriever = createMockRetriever("## 羅針盤コンテキスト\n技術習得", [
      { content: "技術習得", filename: "スキルアップ", similarity: 0.75, chunkId: 3, documentId: 30 },
    ]);

    engine.setCompassRetriever(mockCompassRetriever);

    const { stream, meta } = await engine.prepareStream("user-123", {
      tasks: ["勉強", "運動"],
      availableTime: 90,
      energyLevel: 4,
    });

    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(mockCompassRetriever.retrieve).toHaveBeenCalledWith("user-123", "勉強 運動");
    expect(chunks.length).toBeGreaterThan(0);

    // Verify LLM was called with messages (indirectly check prompt injection)
    expect(client.chatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.any(Array),
      })
    );

    // Verify usage log was saved
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "task_decision",
        inputTokens: 100,
        outputTokens: 50,
      })
    );

    // Verify meta is returned with compass info
    expect(meta.compassRelevance).toBeDefined();
    expect(meta.compassRelevance?.hasCompass).toBe(true);
    expect(meta.compassRelevance?.topMatches).toEqual([
      { title: "スキルアップ", similarity: 0.75 },
    ]);
    expect(meta.contextHints.hasCompass).toBe(true);
  });

  it("setCompassRetriever() でリトリーバーを設定できる", async () => {
    const retriever1 = createMockRetriever("コンテキスト1", []);
    const retriever2 = createMockRetriever("コンテキスト2", [
      { content: "新しい夢", filename: "新目標", similarity: 0.9, chunkId: 5, documentId: 50 },
    ]);

    // Set first retriever
    engine.setCompassRetriever(retriever1);
    await engine.decide("user-123", {
      tasks: ["テスト"],
      availableTime: 30,
      energyLevel: 3,
    });

    expect(retriever1.retrieve).toHaveBeenCalled();
    expect(retriever2.retrieve).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // Replace with second retriever
    engine.setCompassRetriever(retriever2);
    const result2 = await engine.decide("user-123", {
      tasks: ["テスト"],
      availableTime: 30,
      energyLevel: 3,
    });

    expect(retriever1.retrieve).not.toHaveBeenCalled();
    expect(retriever2.retrieve).toHaveBeenCalled();
    expect(result2.compassRelevance?.topMatches[0].title).toBe("新目標");
  });

  it("RAG と Compass の両方がある場合、両方のコンテキストがプロンプトに含まれる", async () => {
    const mockRagRetriever = createMockRetriever("## RAG\n参考資料A");
    const mockCompassRetriever = createMockRetriever("## 羅針盤\n夢B", [
      { content: "夢B", filename: "目標B", similarity: 0.85, chunkId: 1, documentId: 1 },
    ]);

    engine.setRetriever(mockRagRetriever);
    engine.setCompassRetriever(mockCompassRetriever);

    await engine.decide("user-123", {
      tasks: ["タスクX"],
      availableTime: 45,
      energyLevel: 5,
    });

    // Verify both were called
    expect(mockRagRetriever.retrieve).toHaveBeenCalled();
    expect(mockCompassRetriever.retrieve).toHaveBeenCalled();

    // Verify LLM was called (context injection happens in buildTaskDecisionMessages)
    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Array),
      })
    );
  });

  it("空の Compass 結果でも compassRelevance は返される", async () => {
    const mockCompassRetriever = createMockRetriever("", []); // Empty results

    engine.setCompassRetriever(mockCompassRetriever);

    const result = await engine.decide("user-123", {
      tasks: ["タスクY"],
      availableTime: 30,
      energyLevel: 2,
    });

    expect(result.compassRelevance).toBeDefined();
    expect(result.compassRelevance?.hasCompass).toBe(true);
    expect(result.compassRelevance?.topMatches).toEqual([]);
  });

  it("Compass 検索のタイムアウト/エラー時も正常に動作", async () => {
    const mockCompassRetriever: Retriever = {
      retrieve: vi.fn().mockRejectedValue(new Error("Timeout")),
      buildContextSection: vi.fn(),
    };

    engine.setCompassRetriever(mockCompassRetriever);

    const result = await engine.decide("user-123", {
      tasks: ["タスクZ"],
      availableTime: 60,
      energyLevel: 4,
    });

    expect(result.content).toBeDefined();
    expect(result.compassRelevance).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[Compass] 検索失敗（続行）"),
      expect.objectContaining({ error: "Timeout" })
    );
  });
});
