import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/share/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
  handleAuthError: vi.fn((error) => {
    throw error;
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sharedResult: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("test-user");
    vi.mocked(prisma.sharedResult.count).mockResolvedValue(0 as never);
  });

  it("正常に共有リンクを作成する", async () => {
    vi.mocked(prisma.sharedResult.create).mockResolvedValue({
      id: "abc123",
      userId: "test-user",
      content: "test content",
      tasks: "[]",
      provider: "openai",
      model: "gpt-4o-mini",
      createdAt: new Date(),
      expiresAt: new Date(),
    } as never);

    const res = await POST(createRequest({
      content: "test content",
      tasks: ["task1"],
      provider: "openai",
      model: "gpt-4o-mini",
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("abc123");
    expect(data.url).toBe("/share/abc123");
  });

  it("contentが空の場合400を返す", async () => {
    const res = await POST(createRequest({ content: "" }));
    expect(res.status).toBe(400);
  });

  it("contentが10000文字を超える場合400を返す", async () => {
    const res = await POST(createRequest({
      content: "a".repeat(10001),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("10000");
  });

  it("1日10件の上限を超えた場合429を返す", async () => {
    vi.mocked(prisma.sharedResult.count).mockResolvedValue(10 as never);

    const res = await POST(createRequest({
      content: "test content",
    }));
    expect(res.status).toBe(429);
  });
});
