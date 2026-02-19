import { prisma } from "../db/prisma";
import plansConfig from "../../../config/plans.json";

export type PlanId = "free" | "pro";

export interface PlanInfo {
  plan: PlanId;
  monthlyRequestLimit: number;
  ragEnabled: boolean;
  weeklyReviewEnabled: boolean;
  compassEnabled: boolean;
  compassMaxItems: number;
  compassImageEnabled: boolean;
  compassUrlEnabled: boolean;
  feedEnabled: boolean;
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
    compassEnabled: planConfig.compass_enabled,
    compassMaxItems: planConfig.compass_max_items,
    compassImageEnabled: planConfig.compass_image_enabled,
    compassUrlEnabled: planConfig.compass_url_enabled,
    feedEnabled: planConfig.feed_enabled,
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

export async function checkCompassLimit(
  userId: string,
  type: "text" | "url" | "image",
  plan?: PlanInfo
): Promise<{ allowed: boolean; error?: string }> {
  const resolvedPlan = plan ?? await getUserPlan(userId);

  if (!resolvedPlan.compassEnabled) {
    return { allowed: false, error: "羅針盤機能はご利用いただけません" };
  }

  if (type === "image" && !resolvedPlan.compassImageEnabled) {
    return { allowed: false, error: "画像の追加はProプランで利用できます" };
  }

  if (type === "url" && !resolvedPlan.compassUrlEnabled) {
    return { allowed: false, error: "URL取り込みはProプランで利用できます" };
  }

  if (resolvedPlan.compassMaxItems !== -1) {
    const count = await prisma.compassItem.count({ where: { userId } });
    if (count >= resolvedPlan.compassMaxItems) {
      return {
        allowed: false,
        error: `羅針盤アイテムの上限(${resolvedPlan.compassMaxItems}件)に達しました。Proプランにアップグレードしてください。`,
      };
    }
  }

  return { allowed: true };
}
