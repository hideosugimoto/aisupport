import { describe, it, expect, vi } from "vitest";
import { TaskBreakdownEngine } from "@/lib/decision/task-breakdown-engine";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";
import type { UsageLogRepository } from "@/lib/db/types";

function createMockLLMClient(content: string = "mock breakdown"): LLMClient {
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

describe("TaskBreakdownEngine", () => {
  it("should call LLM and return breakdown result", async () => {
    const client = createMockLLMClient("### サブタスク一覧\n1. サブタスクA");
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    const result = await engine.breakdown("test-user", {
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(result.content).toContain("サブタスクA");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(client.chat).toHaveBeenCalledTimes(1);
  });

  it("should save usage log with feature=task_breakdown", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    await engine.breakdown("test-user", {
      task: "タスクA",
      availableTime: 30,
      energyLevel: 4,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4o-mini",
        feature: "task_breakdown",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })
    );
  });

  it("should use custom model when provided", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai", "gpt-4o");

    await engine.breakdown("test-user", {
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" })
    );
  });
});

describe("TaskBreakdownEngine - breakdownStream", () => {
  it("should stream breakdown chunks", async () => {
    const client = createMockLLMClient("サブタスク1 サブタスク2");
    // chatStream を proper mock にする
    client.chatStream = async function* () {
      yield { content: "サブタスク1", done: false };
      yield {
        content: " サブタスク2",
        done: true,
        usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
      };
    };
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of engine.breakdownStream("test-user", {
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("サブタスク1");
    expect(chunks[1].done).toBe(true);
  });

  it("should save usage log after stream completes", async () => {
    const client = createMockLLMClient();
    client.chatStream = async function* () {
      yield {
        content: "done",
        done: true,
        usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
      };
    };
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    for await (const _chunk of engine.breakdownStream("test-user", {
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    })) {
      // consume stream
    }

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "task_breakdown",
        inputTokens: 80,
        outputTokens: 40,
      })
    );
  });

  it("should save usage log even when stream errors", async () => {
    const client = createMockLLMClient();
    client.chatStream = async function* () {
      yield {
        content: "partial",
        done: false,
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      };
      throw new Error("stream error");
    };
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    const chunks: LLMStreamChunk[] = [];
    try {
      for await (const chunk of engine.breakdownStream("test-user", {
        task: "タスクA",
        availableTime: 60,
        energyLevel: 3,
      })) {
        chunks.push(chunk);
      }
    } catch {
      // expected error
    }

    expect(chunks).toHaveLength(1);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "task_breakdown",
        inputTokens: 50,
        outputTokens: 20,
      })
    );
  });
});
