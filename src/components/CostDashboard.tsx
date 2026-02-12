"use client";

import { useEffect, useState } from "react";

interface CostBreakdown {
  provider: string;
  model: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costUsd: number;
  costJpy: number;
}

interface MonthlyCostSummary {
  year: number;
  month: number;
  totalCostUsd: number;
  totalCostJpy: number;
  breakdowns: CostBreakdown[];
}

interface DailyCost {
  date: string;
  costUsd: number;
  costJpy: number;
}

interface BudgetStatus {
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
  alertLevel: "ok" | "warning" | "exceeded";
}

interface CostData {
  summary: MonthlyCostSummary;
  dailyCosts: DailyCost[];
  budget: BudgetStatus;
}

export function CostDashboard() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cost")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="text-center text-zinc-500 py-12">読み込み中...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, dailyCosts, budget } = data;
  const maxDailyCost = Math.max(...dailyCosts.map((d) => d.costJpy), 0.01);

  // 予算アラートレベルに応じた色とメッセージ
  const getAlertColor = () => {
    if (budget.alertLevel === "exceeded") return "red";
    if (budget.alertLevel === "warning") return "yellow";
    return "green";
  };

  const getProgressBarColor = () => {
    if (budget.alertLevel === "exceeded") return "bg-red-600 dark:bg-red-500";
    if (budget.alertLevel === "warning") return "bg-yellow-600 dark:bg-yellow-500";
    return "bg-green-600 dark:bg-green-500";
  };

  return (
    <div className="space-y-8">
      {/* 予算警告バナー */}
      {budget.alertLevel === "exceeded" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            月間予算を超過しています
          </p>
        </div>
      )}
      {budget.alertLevel === "warning" && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            予算の80%を超えました
          </p>
        </div>
      )}

      {/* 予算プログレスバー */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          月間予算
        </h2>
        <div className="space-y-2">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              ${budget.spentUsd.toFixed(2)}
            </span>
            <span className="text-sm text-zinc-400">
              / ${budget.budgetUsd.toFixed(2)}
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor()} transition-all duration-300`}
              style={{
                width: `${Math.min(budget.percentUsed, 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              使用率: {budget.percentUsed.toFixed(1)}%
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              残額: ${budget.remainingUsd.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 当月合計 */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {summary.year}年{summary.month}月 合計コスト
        </h2>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            ¥{summary.totalCostJpy.toFixed(2)}
          </span>
          <span className="text-sm text-zinc-400">
            ${summary.totalCostUsd.toFixed(4)}
          </span>
        </div>
      </div>

      {/* エンジン別・モデル別内訳 */}
      {summary.breakdowns.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">
            内訳
          </h2>
          <div className="space-y-3">
            {summary.breakdowns.map((b) => (
              <div
                key={`${b.provider}-${b.model}`}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {b.provider}
                  </span>
                  <span className="text-xs text-zinc-400 ml-2">{b.model}</span>
                  <span className="text-xs text-zinc-400 ml-2">
                    ({b.requestCount}回)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    ¥{b.costJpy.toFixed(2)}
                  </div>
                  <div className="text-xs text-zinc-400">
                    ${b.costUsd.toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 直近7日推移 */}
      {dailyCosts.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">
            直近7日の推移
          </h2>
          <div className="space-y-2">
            {dailyCosts.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-20">{d.date}</span>
                <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-zinc-600 dark:bg-zinc-400 rounded"
                    style={{
                      width: `${(d.costJpy / maxDailyCost) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-20 text-right">
                  ¥{d.costJpy.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.breakdowns.length === 0 && dailyCosts.length === 0 && (
        <div className="text-center text-zinc-400 py-8">
          まだ利用データがありません
        </div>
      )}
    </div>
  );
}
