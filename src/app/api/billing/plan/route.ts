import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan, checkRequestLimit } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);
    const { remaining } = await checkRequestLimit(userId);

    const byokKeys = await prisma.userApiKey.findMany({
      where: { userId },
      select: { provider: true },
    });
    const hasByok = byokKeys.length > 0;

    return Response.json({
      plan: plan.plan,
      monthlyRequestLimit: plan.monthlyRequestLimit,
      ragEnabled: plan.ragEnabled,
      weeklyReviewEnabled: plan.weeklyReviewEnabled,
      remaining,
      hasByok,
      canSelectModel: plan.plan === "pro" || hasByok,
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[billing/plan]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "プラン情報の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}
