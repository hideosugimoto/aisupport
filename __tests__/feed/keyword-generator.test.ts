import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeywordGenerator } from "@/lib/feed/keyword-generator";
import type { LLMClient } from "@/lib/llm/types";
import { createMockLogger } from "../helpers/mock-logger";

vi.mock("@/lib/llm/prompt-builder", () => ({
  loadTemplate: vi.fn().mockReturnValue("template {{compass_items}}"),
  sanitizePromptInput: vi.fn().mockImplementation((text: string) => text),
}));

const mockLLMClient: LLMClient = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  extractUsage: vi.fn(),
};
const mockLogger = createMockLogger();

describe("KeywordGenerator", () => {
  let generator: KeywordGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new KeywordGenerator(mockLLMClient, "gpt-4o-mini", mockLogger);
  });

  it("should generate keywords from compass items", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify(["Web開発", "TypeScript", "副業 エンジニア"]),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const result = await generator.generate([
      { title: "Webエンジニアになりたい", content: "フロントエンド開発を学びたい" },
      { title: "副業で稼ぎたい", content: "エンジニアスキルを活かして副収入" },
    ]);
    expect(result).toEqual(["Web開発", "TypeScript", "副業 エンジニア"]);
    expect(mockLLMClient.chat).toHaveBeenCalledOnce();
  });

  it("should return empty array when compass items are empty", async () => {
    const result = await generator.generate([]);
    expect(result).toEqual([]);
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });

  it("should return empty array on invalid JSON response", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: "これはJSONではありません",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const result = await generator.generate([{ title: "テスト", content: "テスト内容" }]);
    expect(result).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should truncate keywords to max 10", async () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => `keyword-${i}`);
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify(tooMany),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const result = await generator.generate([{ title: "テスト", content: "テスト内容" }]);
    expect(result).toHaveLength(10);
  });

  it("should handle markdown code fence in response", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: '```json\n["AI", "機械学習"]\n```',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    const result = await generator.generate([{ title: "AI学習", content: "機械学習を勉強中" }]);
    expect(result).toEqual(["AI", "機械学習"]);
  });
});
