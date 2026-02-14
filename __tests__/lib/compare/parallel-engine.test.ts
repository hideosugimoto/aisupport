import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ParallelDecisionEngine,
  DefaultParallelDecisionEngine,
} from "@/lib/compare/parallel-engine";
import type { LLMClient, LLMResponse } from "@/lib/llm/types";
import type { TaskDecisionInput } from "@/lib/llm/prompt-builder";

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
      const results = await engine.compareAll("test-user", input);

      expect(results).toHaveLength(3);

      const openaiResult = results.find((r) => r.provider === "openai");
      expect(openaiResult).toBeDefined();
      expect(openaiResult?.decision).toBe("OpenAI の判定");
      expect(openaiResult?.usage.totalTokens).toBe(150);
      expect(openaiResult?.error).toBeUndefined();

      const geminiResult = results.find((r) => r.provider === "gemini");
      expect(geminiResult).toBeDefined();
      expect(geminiResult?.decision).toBe("Gemini の判定");

      const claudeResult = results.find((r) => r.provider === "claude");
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
      const results = await engine.compareAll("test-user", input);

      results.forEach((result) => {
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
      const results = await engine.compareAll("test-user", input);

      expect(results[0].costUsd).toBeGreaterThan(0);
      expect(typeof results[0].costUsd).toBe("number");
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
      const results = await engine.compareAll("test-user", input);

      expect(results).toHaveLength(2);

      const openaiResult = results.find((r) => r.provider === "openai");
      expect(openaiResult?.error).toBeUndefined();
      expect(openaiResult?.decision).toBe("成功");

      const geminiResult = results.find((r) => r.provider === "gemini");
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
      const results = await engine.compareAll("test-user", input);

      expect(results).toHaveLength(3);
      const successCount = results.filter((r) => !r.error).length;
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
      const results = await engine.compareAll("test-user", input);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
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
});
