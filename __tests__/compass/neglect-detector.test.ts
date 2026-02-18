import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultNeglectDetector } from "@/lib/compass/neglect-detector";
import type { Embedder } from "@/lib/rag/embedder";
import type { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";

describe("DefaultNeglectDetector", () => {
  const mockEmbedder: Embedder = {
    embed: vi.fn(),
    embedSingle: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  };

  const mockVectorStore = {
    search: vi.fn(),
  } as unknown as PrismaCompassVectorStore;

  let detector: DefaultNeglectDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new DefaultNeglectDetector(mockEmbedder, mockVectorStore);
  });

  it("should return null when no compass items exist", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([]);

    const result = await detector.detect("user-1", "今日のタスク");

    expect(mockEmbedder.embedSingle).toHaveBeenCalledWith("今日のタスク");
    expect(mockVectorStore.search).toHaveBeenCalledWith("user-1", [0.1, 0.2, 0.3], 100);
    expect(result).toBeNull();
  });

  it("should return the compass item with the lowest similarity when multiple items exist", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 10, content: "起業の夢", filename: "ビジネス目標", similarity: 0.85 },
      { chunkId: 2, documentId: 10, content: "起業の計画", filename: "ビジネス目標", similarity: 0.80 },
      { chunkId: 3, documentId: 20, content: "健康的な生活", filename: "健康目標", similarity: 0.45 },
      { chunkId: 4, documentId: 30, content: "英語学習の夢", filename: "学習目標", similarity: 0.62 },
      { chunkId: 5, documentId: 30, content: "TOEIC 900点", filename: "学習目標", similarity: 0.55 },
    ]);

    const result = await detector.detect("user-1", "今日のプログラミング作業");

    // compassItem 10: max similarity = 0.85
    // compassItem 20: max similarity = 0.45 (lowest = most neglected)
    // compassItem 30: max similarity = 0.62
    expect(result).not.toBeNull();
    expect(result!.compassItemId).toBe(20);
    expect(result!.title).toBe("健康目標");
    expect(result!.content).toBe("健康的な生活");
    expect(result!.similarity).toBe(0.45);
  });

  it("should return the single compass item when only one exists", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 99, content: "世界一周旅行", filename: "旅行の夢", similarity: 0.3 },
    ]);

    const result = await detector.detect("user-1", "コード作業");

    expect(result).not.toBeNull();
    expect(result!.compassItemId).toBe(99);
    expect(result!.title).toBe("旅行の夢");
    expect(result!.content).toBe("世界一周旅行");
    expect(result!.similarity).toBe(0.3);
  });

  it("should take the MAX similarity chunk when a single compass item has multiple chunks", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([
      { chunkId: 1, documentId: 10, content: "概要", filename: "目標A", similarity: 0.3 },
      { chunkId: 2, documentId: 10, content: "詳細", filename: "目標A", similarity: 0.9 },
      { chunkId: 3, documentId: 20, content: "別の夢", filename: "目標B", similarity: 0.5 },
    ]);

    const result = await detector.detect("user-1", "タスク");

    // compassItem 10: max similarity = 0.9 (not 0.3)
    // compassItem 20: max similarity = 0.5 (lowest = most neglected)
    expect(result!.compassItemId).toBe(20);
    expect(result!.similarity).toBe(0.5);
  });

  it("should call search with topK=100 to retrieve all compass items", async () => {
    vi.mocked(mockVectorStore.search).mockResolvedValue([]);

    await detector.detect("user-42", "任意のタスク");

    expect(mockVectorStore.search).toHaveBeenCalledWith("user-42", expect.any(Array), 100);
  });
});
