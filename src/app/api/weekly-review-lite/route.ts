import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const userId = await requireAuth();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const decisions = await prisma.taskDecision.findMany({
      where: {
        userId,
        createdAt: { gte: weekAgo },
      },
      select: { tasksInput: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // ユニーク日数
    const uniqueDays = new Set(
      decisions.map((d) => d.createdAt.toISOString().split("T")[0])
    ).size;

    // よく判定したタスク（上位5件）
    const taskCounts = new Map<string, number>();
    for (const d of decisions) {
      try {
        const tasks: string[] = JSON.parse(d.tasksInput);
        for (const t of tasks) {
          taskCounts.set(t, (taskCounts.get(t) ?? 0) + 1);
        }
      } catch {
        // skip invalid
      }
    }
    const topTasks = [...taskCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([task]) => task);

    return Response.json({
      totalDecisions: decisions.length,
      uniqueDays,
      topTasks,
      periodStart: weekAgo.toISOString(),
      periodEnd: now.toISOString(),
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
