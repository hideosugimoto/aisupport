import { NextRequest } from "next/server";
import { CostCalculator } from "@/lib/cost/calculator";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

const repository = new PrismaUsageLogRepository(prisma);
const calculator = new CostCalculator(repository);

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    // BYOKユーザーの自分のAPIキー使用分のみ表示
    const keySource = "user";

    const [summary, dailyCosts, versionStats] = await Promise.all([
      calculator.getMonthlySummary(userId, year, month, keySource),
      calculator.getDailyCosts(userId, from, to, keySource),
      calculator.getPromptVersionStats(userId, year, month, keySource),
    ]);

    return Response.json({ summary, dailyCosts, versionStats });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json(
        { error: "コスト情報の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}
