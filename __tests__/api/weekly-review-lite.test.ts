import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/weekly-review-lite/route";

vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
  handleAuthError: vi.fn((error) => {
    throw error;
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskDecision: {
      findMany: vi.fn(),
    },
  },
}));

import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

describe("GET /api/weekly-review-lite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("test-user");
  });

  it("過去7日間の集計結果を返す", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);

    vi.mocked(prisma.taskDecision.findMany).mockResolvedValue([
      { tasksInput: JSON.stringify(["タスクA", "タスクB"]), createdAt: now },
      { tasksInput: JSON.stringify(["タスクA"]), createdAt: yesterday },
      { tasksInput: JSON.stringify(["タスクC"]), createdAt: yesterday },
    ] as never);

    const res = await GET();
    const data = await res.json();

    expect(data.totalDecisions).toBe(3);
    expect(data.uniqueDays).toBe(2);
    expect(data.topTasks).toContain("タスクA");
    expect(data.topTasks.length).toBeLessThanOrEqual(5);
    expect(data.periodStart).toBeDefined();
    expect(data.periodEnd).toBeDefined();
  });

  it("データがない場合はゼロを返す", async () => {
    vi.mocked(prisma.taskDecision.findMany).mockResolvedValue([] as never);

    const res = await GET();
    const data = await res.json();

    expect(data.totalDecisions).toBe(0);
    expect(data.uniqueDays).toBe(0);
    expect(data.topTasks).toEqual([]);
  });

  it("不正なJSONのtasksInputをスキップする", async () => {
    vi.mocked(prisma.taskDecision.findMany).mockResolvedValue([
      { tasksInput: "invalid-json", createdAt: new Date() },
      { tasksInput: JSON.stringify(["タスクX"]), createdAt: new Date() },
    ] as never);

    const res = await GET();
    const data = await res.json();

    expect(data.totalDecisions).toBe(2);
    expect(data.topTasks).toEqual(["タスクX"]);
  });
});
