import { prisma } from "../db/prisma";
import plansConfig from "../../../config/plans.json";

export type PlanId = "free" | "pro";

export interface PlanInfo {
  plan: PlanId;
  monthlyRequestLimit: number;
  ragEnabled: boolean;
  weeklyReviewEnabled: boolean;
}

export async function getUserPlan(userId: string): Promise<PlanInfo> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const planId = (subscription?.plan ?? plansConfig.default_plan) as PlanId;
  const planConfig = plansConfig.plans[planId] ?? plansConfig.plans.free;

  return {
    plan: planId,
    monthlyRequestLimit: planConfig.monthly_request_limit,
    ragEnabled: planConfig.rag_enabled,
    weeklyReviewEnabled: planConfig.weekly_review_enabled,
  };
}

export async function checkRequestLimit(
  userId: string,
  plan?: PlanInfo
): Promise<{ allowed: boolean; remaining: number }> {
  const resolvedPlan = plan ?? await getUserPlan(userId);

  if (resolvedPlan.monthlyRequestLimit === -1) {
    return { allowed: true, remaining: -1 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const count = await prisma.llmUsageLog.count({
    where: {
      userId,
      createdAt: { gte: monthStart, lt: monthEnd },
    },
  });

  const remaining = Math.max(0, resolvedPlan.monthlyRequestLimit - count);
  return { allowed: count < resolvedPlan.monthlyRequestLimit, remaining };
}
