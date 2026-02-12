import { NextRequest } from "next/server";
import { CostCalculator } from "@/lib/cost/calculator";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";

const repository = new PrismaUsageLogRepository(prisma);
const calculator = new CostCalculator(repository);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = Number(searchParams.get("year")) || now.getFullYear();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;

    const summary = await calculator.getMonthlySummary(year, month);

    // 直近7日の日別推移
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const dailyCosts = await calculator.getDailyCosts(from, to);

    return Response.json({ summary, dailyCosts });
  } catch (error) {
    return Response.json(
      { error: "コスト情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
