import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompassSuggester } from "@/lib/compass/compass-suggester";
import type { NeglectDetector, NeglectedCompass } from "@/lib/compass/neglect-detector";
import type { LLMClient } from "@/lib/llm/types";
import { createMockLogger } from "../helpers/mock-logger";

// Mock prompt-builder to avoid file system access during tests
vi.mock("@/lib/llm/prompt-builder", () => ({
  loadTemplate: vi.fn().mockReturnValue(
    "あなたはアシスタントです。{{compass_title}} {{compass_content}} {{available_time}} {{energy_level}}"
  ),
  sanitizePromptInput: vi.fn().mockImplementation((text: string) => text),
}));

const mockNeglectDetector: NeglectDetector = {
  detect: vi.fn(),
};

const mockLLMClient: LLMClient = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  extractUsage: vi.fn(),
};

const MODEL = "gpt-4o-mini";

const mockLogger = createMockLogger();

describe("CompassSuggester", () => {
  let suggester: CompassSuggester;

  beforeEach(() => {
    vi.clearAllMocks();
    suggester = new CompassSuggester(mockNeglectDetector, mockLLMClient, MODEL, mockLogger);
  });

  it("should return null when NeglectDetector returns null", async () => {
    vi.mocked(mockNeglectDetector.detect).mockResolvedValue(null);

    const result = await suggester.suggest("user-1", {
      tasks: ["タスクA", "タスクB"],
      timeMinutes: 30,
      energyLevel: 3,
    });

    expect(result).toBeNull();
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });

  it("should return CompassSuggestion with correct fields on normal flow", async () => {
    const neglectedCompass: NeglectedCompass = {
      compassItemId: 42,
      title: "英語を流暢に話す",
      content: "ネイティブと自然に会話できるようになりたい",
      similarity: 0.2,
    };

    vi.mocked(mockNeglectDetector.detect).mockResolvedValue(neglectedCompass);
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify({
        suggestedTask: "英語の技術記事を1つ読んで、知らなかった単語を3つメモする",
        reason: "英語力向上のための小さな一歩として最適です",
        timeEstimate: 25,
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await suggester.suggest("user-1", {
      tasks: ["プログラミング作業", "コードレビュー"],
      timeMinutes: 30,
      energyLevel: 3,
    });

    expect(result).not.toBeNull();
    expect(result!.compassItemId).toBe(42);
    expect(result!.compassTitle).toBe("英語を流暢に話す");
    expect(result!.suggestedTask).toBe("英語の技術記事を1つ読んで、知らなかった単語を3つメモする");
    expect(result!.reason).toBe("英語力向上のための小さな一歩として最適です");
    expect(result!.timeEstimate).toBe(25);
  });

  it("should pass joined tasks as query to NeglectDetector", async () => {
    vi.mocked(mockNeglectDetector.detect).mockResolvedValue(null);

    await suggester.suggest("user-2", {
      tasks: ["タスクA", "タスクB", "タスクC"],
      timeMinutes: 60,
      energyLevel: 4,
    });

    expect(mockNeglectDetector.detect).toHaveBeenCalledWith(
      "user-2",
      "タスクA タスクB タスクC"
    );
  });

  it("should return null when LLM returns invalid JSON", async () => {
    const neglectedCompass: NeglectedCompass = {
      compassItemId: 10,
      title: "世界一周旅行",
      content: "定年前に世界を旅したい",
      similarity: 0.15,
    };

    vi.mocked(mockNeglectDetector.detect).mockResolvedValue(neglectedCompass);
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: "これはJSONではありません。テキストだけです。",
      usage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
    });

    const result = await suggester.suggest("user-1", {
      tasks: ["事務作業"],
      timeMinutes: 20,
      energyLevel: 2,
    });

    expect(result).toBeNull();
  });

  it("should return null when LLM throws an error", async () => {
    const neglectedCompass: NeglectedCompass = {
      compassItemId: 5,
      title: "起業する",
      content: "自分のビジネスを立ち上げたい",
      similarity: 0.1,
    };

    vi.mocked(mockNeglectDetector.detect).mockResolvedValue(neglectedCompass);
    vi.mocked(mockLLMClient.chat).mockRejectedValue(new Error("LLM API error"));

    const result = await suggester.suggest("user-1", {
      tasks: ["今日の業務"],
      timeMinutes: 45,
      energyLevel: 5,
    });

    expect(result).toBeNull();
  });

  it("should return null when NeglectDetector throws an error", async () => {
    vi.mocked(mockNeglectDetector.detect).mockRejectedValue(
      new Error("Database connection failed")
    );

    const result = await suggester.suggest("user-1", {
      tasks: ["タスク"],
      timeMinutes: 30,
      energyLevel: 3,
    });

    expect(result).toBeNull();
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });
});
