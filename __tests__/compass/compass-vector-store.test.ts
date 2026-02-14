import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaCompassVectorStore } from "@/lib/compass/compass-vector-store";
import { embeddingToBuffer } from "@/lib/rag/vector-utils";
import { prisma } from "@/lib/db/prisma";

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    compassChunk: {
      findMany: vi.fn(),
    },
  },
}));

describe("PrismaCompassVectorStore", () => {
  let store: PrismaCompassVectorStore;
  const mockUserId = "user-123";

  beforeEach(() => {
    store = new PrismaCompassVectorStore();
    vi.clearAllMocks();
  });

  it("チャンクを検索して類似度順にソートする", async () => {
    const queryEmbedding = [1, 0, 0];

    // Mock chunks with varying similarities
    const mockChunks = [
      {
        id: 1,
        content: "夢を追いかける",
        embedding: embeddingToBuffer([0.8, 0.6, 0]), // similarity ~0.8
        compassItemId: 10,
        compassItem: { title: "起業の夢" },
      },
      {
        id: 2,
        content: "健康的な生活",
        embedding: embeddingToBuffer([0.5, 0.5, 0.7]), // similarity ~0.5
        compassItemId: 20,
        compassItem: { title: "健康目標" },
      },
      {
        id: 3,
        content: "プログラミングスキル",
        embedding: embeddingToBuffer([0.9, 0.4, 0.1]), // similarity ~0.9
        compassItemId: 30,
        compassItem: { title: "技術習得" },
      },
    ];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce(mockChunks as any);

    const results = await store.search(mockUserId, queryEmbedding, 3);

    expect(results).toHaveLength(3);
    // Should be sorted by similarity descending
    expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThanOrEqual(results[2].similarity);
    expect(results[0].content).toBe("プログラミングスキル"); // highest similarity
  });

  it("topK 件だけ返す", async () => {
    const queryEmbedding = [1, 0, 0];

    const mockChunks = [
      {
        id: 1,
        content: "チャンク1",
        embedding: embeddingToBuffer([0.9, 0, 0]),
        compassItemId: 1,
        compassItem: { title: "アイテム1" },
      },
      {
        id: 2,
        content: "チャンク2",
        embedding: embeddingToBuffer([0.8, 0, 0]),
        compassItemId: 2,
        compassItem: { title: "アイテム2" },
      },
      {
        id: 3,
        content: "チャンク3",
        embedding: embeddingToBuffer([0.7, 0, 0]),
        compassItemId: 3,
        compassItem: { title: "アイテム3" },
      },
      {
        id: 4,
        content: "チャンク4",
        embedding: embeddingToBuffer([0.6, 0, 0]),
        compassItemId: 4,
        compassItem: { title: "アイテム4" },
      },
    ];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce(mockChunks as any);

    const results = await store.search(mockUserId, queryEmbedding, 2);

    expect(results).toHaveLength(2);
    expect(results[0].content).toBe("チャンク1");
    expect(results[1].content).toBe("チャンク2");
  });

  it("チャンクがない場合は空配列を返す", async () => {
    const queryEmbedding = [1, 0, 0];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce([]);

    const results = await store.search(mockUserId, queryEmbedding, 3);

    expect(results).toEqual([]);
  });

  it("similarity threshold 以下のチャンクを除外する", async () => {
    const queryEmbedding = [1, 0, 0];

    const mockChunks = [
      {
        id: 1,
        content: "高い類似度",
        embedding: embeddingToBuffer([0.9, 0, 0]), // high similarity
        compassItemId: 1,
        compassItem: { title: "関連アイテム" },
      },
      {
        id: 2,
        content: "低い類似度",
        embedding: embeddingToBuffer([0, 1, 0]), // orthogonal, similarity ~0
        compassItemId: 2,
        compassItem: { title: "無関係アイテム" },
      },
      {
        id: 3,
        content: "中程度の類似度",
        embedding: embeddingToBuffer([0.5, 0.5, 0]), // medium similarity
        compassItemId: 3,
        compassItem: { title: "やや関連" },
      },
    ];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce(mockChunks as any);

    const results = await store.search(mockUserId, queryEmbedding, 10);

    // Only chunks above similarity threshold (0.25) should be included
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.similarity).toBeGreaterThanOrEqual(0.25);
    });
  });

  it("バッチ処理: 200件超のチャンクを複数バッチで処理する", async () => {
    const queryEmbedding = [1, 0, 0];

    // First batch (200 chunks)
    const batch1 = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      content: `チャンク${i + 1}`,
      embedding: embeddingToBuffer([0.8, 0, 0]),
      compassItemId: i + 1,
      compassItem: { title: `アイテム${i + 1}` },
    }));

    // Second batch (50 chunks)
    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      id: i + 201,
      content: `チャンク${i + 201}`,
      embedding: embeddingToBuffer([0.8, 0, 0]),
      compassItemId: i + 201,
      compassItem: { title: `アイテム${i + 201}` },
    }));

    vi.mocked(prisma.compassChunk.findMany)
      .mockResolvedValueOnce(batch1 as any)
      .mockResolvedValueOnce(batch2 as any);

    const results = await store.search(mockUserId, queryEmbedding, 10);

    expect(prisma.compassChunk.findMany).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(10); // topK = 10
  });

  it("userId でフィルタリングする", async () => {
    const queryEmbedding = [1, 0, 0];
    const specificUserId = "user-456";

    const mockChunks = [
      {
        id: 1,
        content: "ユーザー専用チャンク",
        embedding: embeddingToBuffer([1, 0, 0]),
        compassItemId: 1,
        compassItem: { title: "専用アイテム" },
      },
    ];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce(mockChunks as any);

    await store.search(specificUserId, queryEmbedding, 3);

    expect(prisma.compassChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { compassItem: { userId: specificUserId } },
      })
    );
  });

  it("結果にドキュメント情報を含む", async () => {
    const queryEmbedding = [1, 0, 0];

    const mockChunks = [
      {
        id: 42,
        content: "テストコンテンツ",
        embedding: embeddingToBuffer([0.9, 0, 0]),
        compassItemId: 99,
        compassItem: { title: "テストタイトル" },
      },
    ];

    vi.mocked(prisma.compassChunk.findMany).mockResolvedValueOnce(mockChunks as any);

    const results = await store.search(mockUserId, queryEmbedding, 1);

    expect(results[0]).toMatchObject({
      chunkId: 42,
      documentId: 99,
      content: "テストコンテンツ",
      filename: "テストタイトル",
    });
    expect(results[0].similarity).toBeGreaterThan(0);
  });
});
