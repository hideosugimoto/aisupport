import { prisma } from "../db/prisma";
import plansConfig from "../../../config/plans.json";
import featuresConfig from "../../../config/features.json";

export type PlanId = "free" | "pro";

export interface PlanInfo {
  plan: PlanId;
  monthlyRequestLimit: number;
  ragEnabled: boolean;
  weeklyReviewEnabled: boolean;
  weeklyReviewLiteEnabled: boolean;
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
    weeklyReviewLiteEnabled: planConfig.weekly_review_lite_enabled,
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
    return { allowed: false, error: "マイゴール機能はご利用いただけません" };
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
        error: `マイゴールの上限(${resolvedPlan.compassMaxItems}件)に達しました。Proプランにアップグレードしてください。`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Freeプラン + 運営API使用の場合、デフォルトモデル以外を拒否。
 * Pro or BYOKユーザーは全モデル利用可。
 */
export function checkModelAccess(
  plan: PlanInfo,
  provider: string,
  model: string,
  keySource: "user" | "platform"
): { allowed: boolean; error?: string } {
  // BYOKユーザーは自分のAPIキーなので制限なし
  if (keySource === "user") {
    return { allowed: true };
  }

  // Proプランは制限なし
  if (plan.plan === "pro") {
    return { allowed: true };
  }

  // Freeプラン + 運営API → デフォルトモデルのみ
  const defaultModel = featuresConfig.default_model[provider as keyof typeof featuresConfig.default_model];
  if (model !== defaultModel) {
    return {
      allowed: false,
      error: `${model} はProプランで利用できます。無料プランでは ${defaultModel} をご利用ください。`,
    };
  }

  return { allowed: true };
}
