import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ParallelDecisionEngine,
  DefaultParallelDecisionEngine,
} from "@/lib/compare/parallel-engine";
import type { LLMClient, LLMResponse } from "@/lib/llm/types";
import type { TaskDecisionInput } from "@/lib/llm/prompt-builder";
import type { Retriever, RetrievalResult } from "@/lib/rag/retriever";

class MockLLMClient implements LLMClient {
  constructor(
    private response: LLMResponse,
    private shouldFail = false,
    private delayMs = 0
  ) {}

  async chat(): Promise<LLMResponse> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.shouldFail) {
      throw new Error("Mock error");
    }
    return this.response;
  }

  async *chatStream() {
    yield { content: "", done: true };
  }

  extractUsage() {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}

// config/features.json をモック
vi.mock("@/lib/config/types", () => ({
  getDefaultModel: (provider: string) => {
    const models: Record<string, string> = {
      openai: "gpt-4o-mini",
      gemini: "gemini-2.0-flash",
      claude: "claude-sonnet-4-20250514",
    };
    return models[provider] || "unknown";
  },
}));

describe("ParallelDecisionEngine", () => {
  let input: TaskDecisionInput;

  beforeEach(() => {
    input = {
      tasks: ["タスクA", "タスクB"],
      availableTime: 120,
      energyLevel: 3,
    };
  });

  describe("compareAll - 全エンジン成功", () => {
    it("全てのエンジンから結果を取得できる", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "OpenAI の判定",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
        gemini: new MockLLMClient({
          content: "Gemini の判定",
          usage: { inputTokens: 120, outputTokens: 60, totalTokens: 180 },
        }),
        claude: new MockLLMClient({
          content: "Claude の判定",
          usage: { inputTokens: 110, outputTokens: 55, totalTokens: 165 },
        }),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.results).toHaveLength(3);

      const openaiResult = response.results.find((r) => r.provider === "openai");
      expect(openaiResult).toBeDefined();
      expect(openaiResult?.decision).toBe("OpenAI の判定");
      expect(openaiResult?.usage.totalTokens).toBe(150);
      expect(openaiResult?.error).toBeUndefined();

      const geminiResult = response.results.find((r) => r.provider === "gemini");
      expect(geminiResult).toBeDefined();
      expect(geminiResult?.decision).toBe("Gemini の判定");

      const claudeResult = response.results.find((r) => r.provider === "claude");
      expect(claudeResult).toBeDefined();
      expect(claudeResult?.decision).toBe("Claude の判定");
    });

    it("各結果に duration が記録される", async () => {
      const clients = {
        openai: new MockLLMClient(
          {
            content: "結果",
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          false,
          50 // 50ms delay
        ),
        gemini: new MockLLMClient({
          content: "結果",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      response.results.forEach((result) => {
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.durationMs).toBe("number");
      });
    });

    it("各結果にコストが計算される", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "結果",
          usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        }),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.results[0].costUsd).toBeGreaterThan(0);
      expect(typeof response.results[0].costUsd).toBe("number");
    });
  });

  describe("compareAll - 一部エンジン失敗", () => {
    it("失敗したエンジンは error フィールドに記録される", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "成功",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
        gemini: new MockLLMClient(
          {
            content: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          true // 失敗
        ),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.results).toHaveLength(2);

      const openaiResult = response.results.find((r) => r.provider === "openai");
      expect(openaiResult?.error).toBeUndefined();
      expect(openaiResult?.decision).toBe("成功");

      const geminiResult = response.results.find((r) => r.provider === "gemini");
      expect(geminiResult?.error).toBeDefined();
      expect(geminiResult?.error).toContain("Mock error");
      expect(geminiResult?.decision).toBe("");
    });

    it("一部失敗でも全結果を返す", async () => {
      const clients = {
        openai: new MockLLMClient(
          {
            content: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          true
        ),
        gemini: new MockLLMClient(
          {
            content: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          true
        ),
        claude: new MockLLMClient({
          content: "Claude のみ成功",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.results).toHaveLength(3);
      const successCount = response.results.filter((r) => !r.error).length;
      expect(successCount).toBe(1);
    });
  });

  describe("compareAll - 全エンジン失敗", () => {
    it("全エンジン失敗でも結果配列を返す", async () => {
      const clients = {
        openai: new MockLLMClient(
          {
            content: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          true
        ),
        gemini: new MockLLMClient(
          {
            content: "",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          true
        ),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.results).toHaveLength(2);
      response.results.forEach((result) => {
        expect(result.error).toBeDefined();
      });
    });
  });

  describe("並列実行の動作確認", () => {
    it("Promise.allSettled() で並列実行される", async () => {
      const startTime = Date.now();

      const clients = {
        openai: new MockLLMClient(
          {
            content: "結果1",
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          false,
          100 // 100ms delay
        ),
        gemini: new MockLLMClient(
          {
            content: "結果2",
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          false,
          100 // 100ms delay
        ),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      await engine.compareAll("test-user", input);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 並列実行なので200ms未満で完了するはず（逐次なら200ms以上）
      expect(totalTime).toBeLessThan(200);
    });
  });

  describe("Compass 統合", () => {
    function createMockRetriever(
      contextText: string,
      results: RetrievalResult["results"] = []
    ): Retriever {
      return {
        retrieve: vi.fn<(userId: string, query: string, topK?: number) => Promise<RetrievalResult>>().mockResolvedValue({
          contextText,
          results,
        }),
        buildContextSection: vi.fn().mockReturnValue(contextText),
      };
    }

    it("compassRetriever なしの場合 compassRelevance は undefined", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "結果",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      const response = await engine.compareAll("test-user", input);

      expect(response.compassRelevance).toBeUndefined();
      expect(response.results).toHaveLength(1);
    });

    it("compassRetriever 設定時、全モデルに同じ Compass コンテキストが注入される", async () => {
      const openaiClient = new MockLLMClient({
        content: "OpenAI 判定",
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
      });
      const geminiClient = new MockLLMClient({
        content: "Gemini 判定",
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
      });
      const clients = { openai: openaiClient, gemini: geminiClient };

      const retriever = createMockRetriever(
        "[マイゴール1: 起業目標 (関連度: 90%)]\n独立して自由に働く",
        [
          { content: "独立して自由に働く", filename: "起業目標", similarity: 0.9, chunkId: 1, documentId: 10 },
          { content: "健康的な生活", filename: "健康目標", similarity: 0.7, chunkId: 2, documentId: 20 },
        ]
      );

      const engine = new DefaultParallelDecisionEngine(clients);
      engine.setCompassRetriever(retriever);

      const response = await engine.compareAll("test-user", input);

      // retriever は1回だけ呼ばれる（全モデル共通）
      expect(retriever.retrieve).toHaveBeenCalledTimes(1);
      expect(retriever.retrieve).toHaveBeenCalledWith("test-user", "タスクA タスクB");

      // compassRelevance が正しく返される
      expect(response.compassRelevance).toBeDefined();
      expect(response.compassRelevance?.hasCompass).toBe(true);
      expect(response.compassRelevance?.topMatches).toHaveLength(2);
      expect(response.compassRelevance?.topMatches[0]).toEqual({
        title: "起業目標",
        similarity: 0.9,
      });

      // 全モデルの結果も正常
      expect(response.results).toHaveLength(2);
      expect(response.results.find(r => r.provider === "openai")?.decision).toBe("OpenAI 判定");
      expect(response.results.find(r => r.provider === "gemini")?.decision).toBe("Gemini 判定");
    });

    it("Compass Retriever が空コンテキストを返した場合、hasCompass は true で topMatches は空", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "結果",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
      };

      const retriever = createMockRetriever("", []);
      const engine = new DefaultParallelDecisionEngine(clients);
      engine.setCompassRetriever(retriever);

      const response = await engine.compareAll("test-user", input);

      expect(retriever.retrieve).toHaveBeenCalledTimes(1);
      // Retriever がセットされていれば hasCompass: true（コンテキストが空でもアイテムは存在する可能性）
      expect(response.compassRelevance?.hasCompass).toBe(true);
      expect(response.compassRelevance?.topMatches).toEqual([]);
      expect(response.results).toHaveLength(1);
    });

    it("Compass Retriever が失敗しても比較は成功する（graceful degradation）", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "成功した結果",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
      };

      const failingRetriever: Retriever = {
        retrieve: vi.fn().mockRejectedValue(new Error("Embedding API error")),
        buildContextSection: vi.fn(),
      };

      const engine = new DefaultParallelDecisionEngine(clients);
      engine.setCompassRetriever(failingRetriever);

      const response = await engine.compareAll("test-user", input);

      expect(response.compassRelevance).toBeUndefined();
      expect(response.results).toHaveLength(1);
      expect(response.results[0].decision).toBe("成功した結果");
      expect(response.results[0].error).toBeUndefined();
    });

    it("Compass ありでも一部エンジン失敗時にエラーが記録される", async () => {
      const clients = {
        openai: new MockLLMClient({
          content: "成功",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        }),
        gemini: new MockLLMClient(
          { content: "", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
          true
        ),
      };

      const retriever = createMockRetriever(
        "[マイゴール1: 目標]",
        [{ content: "目標", filename: "目標", similarity: 0.8, chunkId: 1, documentId: 1 }]
      );

      const engine = new DefaultParallelDecisionEngine(clients);
      engine.setCompassRetriever(retriever);

      const response = await engine.compareAll("test-user", input);

      expect(response.compassRelevance?.hasCompass).toBe(true);
      expect(response.results).toHaveLength(2);
      expect(response.results.find(r => r.provider === "openai")?.error).toBeUndefined();
      expect(response.results.find(r => r.provider === "gemini")?.error).toBeDefined();
    });
  });
});
