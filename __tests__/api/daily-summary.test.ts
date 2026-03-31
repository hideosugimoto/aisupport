import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/daily-summary/route";

vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
  handleAuthError: vi.fn((error) => {
    throw error;
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskDecision: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

describe("GET /api/daily-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("test-user");
  });

  it("昨日のタスク・連続日数・今日の回数を返す", async () => {
    vi.mocked(prisma.taskDecision.findFirst).mockResolvedValue({
      tasksInput: JSON.stringify(["企画書作成", "メール返信"]),
    } as never);

    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { day: today },
      { day: yesterday },
      { day: twoDaysAgo },
    ] as never);

    vi.mocked(prisma.taskDecision.count).mockResolvedValue(2 as never);

    const res = await GET();
    const data = await res.json();

    expect(data.yesterdayTask).toBe("企画書作成");
    expect(data.streakDays).toBe(3);
    expect(data.todayCount).toBe(2);
  });

  it("データがない場合はゼロを返す", async () => {
    vi.mocked(prisma.taskDecision.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    vi.mocked(prisma.taskDecision.count).mockResolvedValue(0 as never);

    const res = await GET();
    const data = await res.json();

    expect(data.yesterdayTask).toBeNull();
    expect(data.streakDays).toBe(0);
    expect(data.todayCount).toBe(0);
  });

  it("tasksInputが不正JSONの場合はyesterdayTaskがnull", async () => {
    vi.mocked(prisma.taskDecision.findFirst).mockResolvedValue({
      tasksInput: "invalid-json",
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    vi.mocked(prisma.taskDecision.count).mockResolvedValue(0 as never);

    const res = await GET();
    const data = await res.json();

    expect(data.yesterdayTask).toBeNull();
  });
});
