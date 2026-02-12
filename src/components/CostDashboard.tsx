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

interface CostData {
  summary: MonthlyCostSummary;
  dailyCosts: DailyCost[];
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

  const { summary, dailyCosts } = data;
  const maxDailyCost = Math.max(...dailyCosts.map((d) => d.costJpy), 0.01);

  return (
    <div className="space-y-8">
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
