import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/compass/route";
import { DELETE } from "@/app/api/compass/[id]/route";

// Mock dependencies
vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
  handleAuthError: vi.fn((error) => {
    throw error;
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    compassItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    compassChunk: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/billing/plan-gate", () => ({
  getUserPlan: vi.fn(),
  checkCompassLimit: vi.fn(),
}));

vi.mock("@/lib/rag/embedder", () => {
  return {
    OpenAIEmbedder: class MockOpenAIEmbedder {
      async embed() {
        return [
          new Float32Array([0.1, 0.2, 0.3]),
          new Float32Array([0.4, 0.5, 0.6]),
        ];
      }
    },
  };
});

vi.mock("@/lib/compass/url-processor", () => ({
  processUrl: vi.fn(),
}));

vi.mock("@/lib/compass/image-processor", () => ({
  validateImage: vi.fn(),
  processImage: vi.fn(),
}));

vi.mock("@/lib/rag/chunker", () => ({
  chunkPlainText: vi.fn(),
}));

vi.mock("@/lib/compass/vision-client");
vi.mock("@/lib/llm/client-factory");
vi.mock("@/lib/billing/key-resolver", () => ({
  resolveApiKey: vi.fn().mockResolvedValue({ apiKey: "test-key" }),
}));
vi.mock("@/lib/config/types", () => ({
  getDefaultModel: vi.fn().mockReturnValue("gpt-4o-mini"),
}));

import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { checkCompassLimit } from "@/lib/billing/plan-gate";
import { processUrl } from "@/lib/compass/url-processor";
import { validateImage, processImage } from "@/lib/compass/image-processor";
import { chunkPlainText } from "@/lib/rag/chunker";

const mockRequireAuth = vi.mocked(requireAuth);
const mockPrisma = vi.mocked(prisma);
const mockCheckCompassLimit = vi.mocked(checkCompassLimit);
const mockProcessUrl = vi.mocked(processUrl);
const mockValidateImage = vi.mocked(validateImage);
const mockProcessImage = vi.mocked(processImage);
const mockChunkPlainText = vi.mocked(chunkPlainText);

describe("GET /api/compass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証済みユーザーのアイテム一覧を返す", async () => {
    mockRequireAuth.mockResolvedValue("user_123");
    mockPrisma.compassItem.findMany.mockResolvedValue([
      {
        id: 1,
        type: "text",
        title: "テストアイテム",
        content: "テスト内容",
        sourceUrl: null,
        imageKey: null,
        createdAt: new Date("2026-01-01"),
        _count: { chunks: 2 },
      },
      {
        id: 2,
        type: "url",
        title: "テストURL",
        content: "URL要約",
        sourceUrl: "https://example.com",
        imageKey: null,
        createdAt: new Date("2026-01-02"),
        _count: { chunks: 3 },
      },
    ] as never);

    const request = new Request("http://localhost/api/compass");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      id: 1,
      type: "text",
      title: "テストアイテム",
      content: "テスト内容",
      chunkCount: 2,
    });
    expect(data.items[1]).toMatchObject({
      id: 2,
      type: "url",
      title: "テストURL",
      sourceUrl: "https://example.com",
      chunkCount: 3,
    });
    expect(mockPrisma.compassItem.findMany).toHaveBeenCalledWith({
      where: { userId: "user_123" },
      orderBy: { createdAt: "desc" },
      select: expect.any(Object),
    });
  });

  it("アイテムがない場合は空配列を返す", async () => {
    mockRequireAuth.mockResolvedValue("user_123");
    mockPrisma.compassItem.findMany.mockResolvedValue([]);

    const request = new Request("http://localhost/api/compass");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
  });
});

describe("POST /api/compass (テキスト)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue("user_123");
    mockCheckCompassLimit.mockResolvedValue({ allowed: true, error: null });
    mockChunkPlainText.mockReturnValue([
      { content: "chunk1", startIndex: 0, endIndex: 10 },
      { content: "chunk2", startIndex: 10, endIndex: 20 },
    ]);
  });

  it("テキストタイプのアイテムを作成できる", async () => {
    mockPrisma.compassItem.create.mockResolvedValue({
      id: 1,
      userId: "user_123",
      type: "text",
      title: "テストタイトル",
      content: "テスト内容です",
      sourceUrl: null,
      imageKey: null,
      createdAt: new Date("2026-01-01"),
      _count: { chunks: 2 },
    } as never);

    const request = new Request("http://localhost/api/compass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        title: "テストタイトル",
        content: "テスト内容です",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.item).toMatchObject({
      id: 1,
      type: "text",
      title: "テストタイトル",
      content: "テスト内容です",
      chunkCount: 2,
    });
    expect(mockPrisma.compassItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_123",
          type: "text",
          title: "テストタイトル",
          content: "テスト内容です",
        }),
      })
    );
  });

  it("content が空の場合 400 を返す", async () => {
    const request = new Request("http://localhost/api/compass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        title: "タイトル",
        content: "   ",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("テキストを入力してください");
  });

  it("プラン制限（max_items）に達している場合 403 を返す", async () => {
    mockCheckCompassLimit.mockResolvedValue({
      allowed: false,
      error: "マイゴールの上限に達しています",
    });

    const request = new Request("http://localhost/api/compass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        title: "タイトル",
        content: "内容",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("上限に達して");
  });
});

describe("POST /api/compass (URL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue("user_123");
    mockChunkPlainText.mockReturnValue([
      { content: "chunk1", startIndex: 0, endIndex: 10 },
    ]);
  });

  it("URLタイプのアイテムを作成できる（processUrl モック）", async () => {
    mockCheckCompassLimit.mockResolvedValue({ allowed: true, error: null });
    mockProcessUrl.mockResolvedValue({
      title: "Example Page",
      summary: "This is a summary of the page",
      fullText: "Full text content of the page",
    });
    mockPrisma.compassItem.create.mockResolvedValue({
      id: 2,
      userId: "user_123",
      type: "url",
      title: "Example Page",
      content: "This is a summary of the page",
      sourceUrl: "https://example.com",
      imageKey: null,
      createdAt: new Date("2026-01-01"),
      _count: { chunks: 1 },
    } as never);

    const request = new Request("http://localhost/api/compass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "url",
        content: "https://example.com",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.item).toMatchObject({
      id: 2,
      type: "url",
      title: "Example Page",
      sourceUrl: "https://example.com",
    });
    expect(mockProcessUrl).toHaveBeenCalledWith(
      "https://example.com",
      undefined, // createLLMClient is mocked and returns undefined
      "gpt-4o-mini"
    );
  });

  it("Freeプランで URL タイプは 403 を返す", async () => {
    mockCheckCompassLimit.mockResolvedValue({
      allowed: false,
      error: "URLタイプはProプラン限定です",
    });

    const request = new Request("http://localhost/api/compass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "url",
        content: "https://example.com",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Proプラン");
  });
});

describe("DELETE /api/compass/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue("user_123");
  });

  it("自分のアイテムを削除できる", async () => {
    mockPrisma.compassItem.findFirst.mockResolvedValue({
      id: 1,
      userId: "user_123",
      type: "text",
      title: "テスト",
      content: "内容",
    } as never);
    mockPrisma.compassItem.delete.mockResolvedValue({} as never);

    const request = new Request("http://localhost/api/compass/1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.compassItem.findFirst).toHaveBeenCalledWith({
      where: { id: 1, userId: "user_123" },
    });
    expect(mockPrisma.compassItem.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it("他人のアイテムは 404 を返す", async () => {
    mockPrisma.compassItem.findFirst.mockResolvedValue(null);

    const request = new Request("http://localhost/api/compass/1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("アイテムが見つかりません");
  });

  it("存在しないIDは 404 を返す", async () => {
    mockPrisma.compassItem.findFirst.mockResolvedValue(null);

    const request = new Request("http://localhost/api/compass/999", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("アイテムが見つかりません");
  });

  it("不正なID（NaN）は 400 を返す", async () => {
    const request = new Request("http://localhost/api/compass/invalid", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "invalid" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("無効なID");
  });

  it("範囲外のID（0以下）は 400 を返す", async () => {
    const request = new Request("http://localhost/api/compass/0", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "0" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("無効なID");
  });

  it("範囲外のID（負の数）は 400 を返す", async () => {
    const request = new Request("http://localhost/api/compass/-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("無効なID");
  });
});
