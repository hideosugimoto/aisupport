import { NextRequest } from "next/server";
import { CostCalculator } from "@/lib/cost/calculator";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { BudgetChecker } from "@/lib/budget/checker";
import featuresConfig from "@/../config/features.json";

const repository = new PrismaUsageLogRepository(prisma);
const calculator = new CostCalculator(repository);
const budgetChecker = new BudgetChecker(
  calculator,
  featuresConfig.monthly_budget_usd
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    // 直近7日の日別推移用の日付範囲
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    // 並列実行: summary, dailyCosts, budget, versionStats
    const [summary, dailyCosts, budget, versionStats] = await Promise.all([
      calculator.getMonthlySummary(year, month),
      calculator.getDailyCosts(from, to),
      budgetChecker.checkBudget(year, month),
      calculator.getPromptVersionStats(year, month),
    ]);

    return Response.json({ summary, dailyCosts, budget, versionStats });
  } catch (error) {
    return Response.json(
      { error: "コスト情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
