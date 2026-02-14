import { describe, it, expect, vi } from "vitest";
import { TaskDecisionEngine } from "@/lib/decision/task-decision-engine";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";
import type { UsageLogRepository } from "@/lib/db/types";

function createMockLLMClient(content: string = "mock decision"): LLMClient {
  return {
    chat: vi.fn<(req: LLMRequest) => Promise<LLMResponse>>().mockResolvedValue({
      content,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      requestId: "req-123",
    }),
    chatStream: vi.fn<(req: LLMRequest) => AsyncIterable<LLMStreamChunk>>(),
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

describe("TaskDecisionEngine", () => {
  it("should call LLM and return decision result", async () => {
    const client = createMockLLMClient("### 今日の最適タスク\nタスクA");
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(client, repo, "openai");

    const result = await engine.decide("test-user", {
      tasks: ["タスクA", "タスクB"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(result.content).toContain("タスクA");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.isAnxietyMode).toBe(false);
    expect(client.chat).toHaveBeenCalledTimes(1);
  });

  it("should save usage log after decision", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(client, repo, "openai");

    await engine.decide("test-user", {
      tasks: ["タスクA"],
      availableTime: 30,
      energyLevel: 4,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4o-mini",
        feature: "task_decision",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })
    );
  });

  it("should set isAnxietyMode=true when energy <= 2", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(client, repo, "openai");

    const result = await engine.decide("test-user", {
      tasks: ["タスクA"],
      availableTime: 15,
      energyLevel: 1,
    });

    expect(result.isAnxietyMode).toBe(true);
  });

  it("should use custom model when provided", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskDecisionEngine(
      client,
      repo,
      "openai",
      "gpt-4o"
    );

    await engine.decide("test-user", {
      tasks: ["タスクA"],
      availableTime: 60,
      energyLevel: 3,
    });

    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" })
    );
  });
});
