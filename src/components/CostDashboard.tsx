"use client";

import { useCallback, useEffect, useState } from "react";

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

interface PromptVersionStats {
  version: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  costUsd: number;
  costJpy: number;
}

interface CostData {
  summary: MonthlyCostSummary;
  dailyCosts: DailyCost[];
  budget: BudgetStatus;
  versionStats: PromptVersionStats[];
}

interface WeeklyReviewData {
  review: string;
  decisionsCount: number;
  periodStart: string;
  periodEnd: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costUsd: number;
}

export function CostDashboard() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleGenerateReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error("レビュー生成に失敗しました");
      }
      const result = await res.json();
      setReviewData(result);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/cost")
      .then((res) => {
        if (!res.ok) throw new Error(`コストデータの取得に失敗しました (${res.status})`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "コストデータの取得に失敗しました");
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

  const { summary, dailyCosts, budget, versionStats } = data;
  const maxDailyCost = Math.max(...dailyCosts.map((d) => d.costJpy), 0.01);

  const getProgressBarColor = () => {
    if (budget.alertLevel === "exceeded") return "bg-red-600 dark:bg-red-500";
    if (budget.alertLevel === "warning") return "bg-yellow-600 dark:bg-yellow-500";
    return "bg-green-600 dark:bg-green-500";
  };

  return (
    <div className="space-y-8">
      {/* 予算警告バナー */}
      {budget.alertLevel === "exceeded" && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            月間予算を超過しています
          </p>
        </div>
      )}
      {budget.alertLevel === "warning" && (
        <div role="alert" className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
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
              role="progressbar"
              aria-valuenow={Math.round(budget.percentUsed)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`予算使用率 ${budget.percentUsed.toFixed(1)}%`}
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
                    role="img"
                    aria-label={`${d.date}: ¥${d.costJpy.toFixed(2)}`}
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

      {/* プロンプトバージョン別統計 */}
      {versionStats && versionStats.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">
            プロンプトバージョン別統計
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    バージョン
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    使用回数
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    平均入力
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    平均出力
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    コスト
                  </th>
                </tr>
              </thead>
              <tbody>
                {versionStats.map((v) => (
                  <tr
                    key={v.version}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <td className="py-2 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                      {v.version}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                      {v.requestCount}回
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                      {v.avgInputTokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                      {v.avgOutputTokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                      <div>¥{v.costJpy.toFixed(2)}</div>
                      <div className="text-xs text-zinc-400">
                        ${v.costUsd.toFixed(4)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 今週のレビュー */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setReviewExpanded(!reviewExpanded)}
          aria-expanded={reviewExpanded}
          className="w-full p-6 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            今週のレビュー
          </h2>
          <svg
            className={`w-5 h-5 text-zinc-400 transition-transform ${
              reviewExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {reviewExpanded && (
          <div className="px-6 pb-6 border-t border-zinc-200 dark:border-zinc-700">
            {!reviewData && !reviewLoading && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleGenerateReview}
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
                >
                  レビュー生成
                </button>
              </div>
            )}

            {reviewLoading && (
              <div className="pt-4 text-center text-zinc-500">
                生成中...
              </div>
            )}

            {reviewError && (
              <div className="pt-4 space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {reviewError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateReview}
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
                >
                  再度試す
                </button>
              </div>
            )}

            {reviewData && (
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    分析期間: {reviewData.periodStart} 〜 {reviewData.periodEnd}
                  </span>
                  <span>分析件数: {reviewData.decisionsCount}件</span>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {reviewData.review}
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <span>
                    トークン使用: {reviewData.usage.totalTokens.toLocaleString()}
                  </span>
                  <span>コスト: ${reviewData.costUsd.toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {summary.breakdowns.length === 0 && dailyCosts.length === 0 && (
        <div className="text-center text-zinc-400 py-8">
          まだ利用データがありません
        </div>
      )}
    </div>
  );
}
