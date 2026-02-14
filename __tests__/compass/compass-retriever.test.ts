import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompassRetriever } from "@/lib/compass/compass-retriever";
import type { Embedder } from "@/lib/rag/embedder";
import type { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";

describe("CompassRetriever", () => {
  const mockEmbedder: Embedder = {
    embed: vi.fn(),
    embedSingle: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };

  const mockVectorStore = {
    search: vi.fn(),
  } as unknown as PrismaCompassVectorStore;

  let retriever: CompassRetriever;

  beforeEach(() => {
    vi.clearAllMocks();
    retriever = new CompassRetriever(mockEmbedder, mockVectorStore);
  });

  it("should retrieve and build context section", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "起業の夢", filename: "将来の目標", similarity: 0.85 },
      { chunkId: 2, documentId: 2, content: "英語学習", filename: "スキルアップ", similarity: 0.62 },
    ]);

    const result = await retriever.retrieve("user-1", "今日やるべきこと");

    expect(mockEmbedder.embedSingle).toHaveBeenCalledWith("今日やるべきこと");
    expect(result.results).toHaveLength(2);
    expect(result.contextText).toContain("羅針盤");
    expect(result.contextText).toContain("将来の目標");
    expect(result.contextText).toContain("スキルアップ");
    expect(result.contextText).toContain("関連度: 85%");
  });

  it("should return empty context when no results", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.results).toHaveLength(0);
    expect(result.contextText).toBe("");
  });

  it("should use custom topK parameter", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "夢1", filename: "目標1", similarity: 0.9 },
      { chunkId: 2, documentId: 2, content: "夢2", filename: "目標2", similarity: 0.8 },
      { chunkId: 3, documentId: 3, content: "夢3", filename: "目標3", similarity: 0.7 },
      { chunkId: 4, documentId: 4, content: "夢4", filename: "目標4", similarity: 0.6 },
      { chunkId: 5, documentId: 5, content: "夢5", filename: "目標5", similarity: 0.5 },
    ]);

    const result = await retriever.retrieve("user-1", "query", 5);

    expect(mockVectorStore.search).toHaveBeenCalledWith("user-1", [0.1, 0.2, 0.3], 5);
    expect(result.results).toHaveLength(5);
  });

  it("should format similarity as percentage", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "高い関連度", filename: "test", similarity: 0.95 },
      { chunkId: 2, documentId: 2, content: "中程度の関連度", filename: "test2", similarity: 0.5 },
      { chunkId: 3, documentId: 3, content: "低い関連度", filename: "test3", similarity: 0.25 },
    ]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.contextText).toContain("関連度: 95%");
    expect(result.contextText).toContain("関連度: 50%");
    expect(result.contextText).toContain("関連度: 25%");
  });

  it("should include document filename in context", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      {
        chunkId: 1,
        documentId: 1,
        content: "キャリア目標",
        filename: "5年後のビジョン.md",
        similarity: 0.8,
      },
    ]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.contextText).toContain("5年後のビジョン.md");
    expect(result.contextText).toContain("キャリア目標");
  });

  it("should number results sequentially", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "項目1", filename: "f1", similarity: 0.9 },
      { chunkId: 2, documentId: 2, content: "項目2", filename: "f2", similarity: 0.8 },
      { chunkId: 3, documentId: 3, content: "項目3", filename: "f3", similarity: 0.7 },
    ]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.contextText).toContain("羅針盤1:");
    expect(result.contextText).toContain("羅針盤2:");
    expect(result.contextText).toContain("羅針盤3:");
  });

  it("should separate results with dividers", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "項目1", filename: "f1", similarity: 0.9 },
      { chunkId: 2, documentId: 2, content: "項目2", filename: "f2", similarity: 0.8 },
    ]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.contextText).toContain("---");
  });

  it("should include header describing purpose", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 1, content: "目標", filename: "test", similarity: 0.8 },
    ]);

    const result = await retriever.retrieve("user-1", "query");

    expect(result.contextText).toContain("あなたの羅針盤");
    expect(result.contextText).toContain("目標・夢・インスピレーション");
    expect(result.contextText).toContain("タスク選定の指針");
  });
});
