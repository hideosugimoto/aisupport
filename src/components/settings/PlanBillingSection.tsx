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
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        プラン・課金
      </h2>

      {planInfo ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                現在のプラン
              </p>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {planInfo.plan === "pro" ? "Pro" : "Free"}
              </p>
            </div>
            {planInfo.plan === "pro" ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                有効
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                無料
              </span>
            )}
          </div>

          {planInfo.plan === "free" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  今月のリクエスト残数
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {planInfo.remaining} / {planInfo.monthlyRequestLimit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                  style={{
                    width: `${planInfo.monthlyRequestLimit > 0 ? Math.min(100, ((planInfo.monthlyRequestLimit - planInfo.remaining) / planInfo.monthlyRequestLimit) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              RAG（ドキュメント検索）:{" "}
              <span className={planInfo.ragEnabled ? "text-green-600 dark:text-green-400" : ""}>
                {planInfo.ragEnabled ? "有効" : "Proプランで利用可"}
              </span>
            </p>
            <p>
              週次レビュー:{" "}
              <span className={planInfo.weeklyReviewEnabled ? "text-green-600 dark:text-green-400" : ""}>
                {planInfo.weeklyReviewEnabled ? "有効" : "Proプランで利用可"}
              </span>
            </p>
          </div>

          {planInfo.plan === "free" ? (
            <button
              type="button"
              onClick={onUpgrade}
              disabled={upgrading}
              aria-busy={upgrading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {upgrading ? "処理中..." : `Proプランにアップグレード (月額${plansConfig.plans.pro.price_jpy}円)`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onManageBilling}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              課金管理（Stripeポータル）
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          プラン情報を読み込み中...
        </p>
      )}
    </div>
  );
}
