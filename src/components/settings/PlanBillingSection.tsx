"use client";

import plansConfig from "../../../config/plans.json";

interface PlanInfo {
  plan: string;
  monthlyRequestLimit: number;
  ragEnabled: boolean;
  weeklyReviewEnabled: boolean;
  remaining: number;
}

interface PlanBillingSectionProps {
  planInfo: PlanInfo | null;
  upgrading: boolean;
  onUpgrade: () => void;
  onManageBilling: () => void;
}

export function PlanBillingSection({
  planInfo,
  upgrading,
  onUpgrade,
  onManageBilling,
}: PlanBillingSectionProps) {
  return (
    <div className="rounded-lg border border-border-brand bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium text-text">
        プラン・課金
      </h2>

      {planInfo ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">
                現在のプラン
              </p>
              <p className="text-lg font-bold text-text">
                {planInfo.plan === "pro" ? "Pro" : "Free"}
              </p>
            </div>
            {planInfo.plan === "pro" ? (
              <span className="rounded-full bg-forest-bg px-3 py-1 text-xs font-medium text-forest">
                有効
              </span>
            ) : (
              <span className="rounded-full bg-bg2 px-3 py-1 text-xs font-medium text-text2">
                無料
              </span>
            )}
          </div>

          {planInfo.plan === "free" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text2">
                  今月のリクエスト残数
                </span>
                <span className="font-medium text-text">
                  {planInfo.remaining} / {planInfo.monthlyRequestLimit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg2">
                <div
                  className="h-2 rounded-full bg-root-bg transition-all"
                  style={{
                    width: `${planInfo.monthlyRequestLimit > 0 ? Math.min(100, ((planInfo.monthlyRequestLimit - planInfo.remaining) / planInfo.monthlyRequestLimit) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1 text-sm text-text2">
            <p>
              RAG（ドキュメント検索）:{" "}
              <span className={planInfo.ragEnabled ? "text-forest" : ""}>
                {planInfo.ragEnabled ? "有効" : "Proプランで利用可"}
              </span>
            </p>
            <p>
              週次レビュー:{" "}
              <span className={planInfo.weeklyReviewEnabled ? "text-forest" : ""}>
                {planInfo.weeklyReviewEnabled ? "有効" : "Proプランで利用可"}
              </span>
            </p>
          </div>

          {planInfo.plan === "free" ? (
            <>
              <button
                type="button"
                onClick={onUpgrade}
                disabled={upgrading}
                aria-busy={upgrading}
                className="w-full rounded-lg bg-root-bg px-4 py-3 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
              >
                {upgrading ? "処理中..." : `Proプランにアップグレード (月額${plansConfig.plans.pro.price_jpy}円)`}
              </button>
              <p className="mt-2 text-center text-xs text-text3">
                年額 {(plansConfig.plans.pro as Record<string, unknown>).annual_price_jpy ? Number((plansConfig.plans.pro as Record<string, unknown>).annual_price_jpy).toLocaleString() : String(plansConfig.plans.pro.price_jpy * 10)}円もあります
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={onManageBilling}
              className="w-full rounded-lg border border-border-brand px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-bg"
            >
              課金管理（Stripeポータル）
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-text2">
          プラン情報を読み込み中...
        </p>
      )}
    </div>
  );
}
