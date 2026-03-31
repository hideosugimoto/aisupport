import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const userId = await requireAuth();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    // 昨日の最新の判定結果
    const yesterdayDecision = await prisma.taskDecision.findFirst({
      where: {
        userId,
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      orderBy: { createdAt: "desc" },
      select: { tasksInput: true },
    });

    let yesterdayTask: string | null = null;
    if (yesterdayDecision) {
      try {
        const tasks = JSON.parse(yesterdayDecision.tasksInput);
        yesterdayTask = Array.isArray(tasks) ? tasks[0] ?? null : null;
      } catch {
        yesterdayTask = null;
      }
    }

    // 連続利用日数（1クエリで日付リストを取得し、アプリ側で連続判定）
    const recentDays = await prisma.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT DATE(created_at) as day
      FROM task_decisions
      WHERE user_id = ${userId}
        AND created_at >= ${new Date(todayStart.getTime() - 365 * 86400000)}
      ORDER BY day DESC
    `;

    let streakDays = 0;
    for (let i = 0; i < recentDays.length; i++) {
      const expectedDate = new Date(todayStart.getTime() - i * 86400000);
      const expectedStr = expectedDate.toISOString().split("T")[0];
      const actualDate = new Date(recentDays[i].day);
      const actualStr = actualDate.toISOString().split("T")[0];

      if (actualStr === expectedStr) {
        streakDays++;
      } else {
        break;
      }
    }

    // 今日の判定回数
    const todayCount = await prisma.taskDecision.count({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
    });

    return Response.json({ yesterdayTask, streakDays, todayCount });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
