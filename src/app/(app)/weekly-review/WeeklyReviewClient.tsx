"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarkdownContent } from "@/components/MarkdownContent";

interface LiteData {
  totalDecisions: number;
  uniqueDays: number;
  topTasks: string[];
  periodStart: string;
  periodEnd: string;
}

interface ProReview {
  review: string;
  decisionsCount: number;
}

interface WeeklyReviewClientProps {
  isPro: boolean;
}

export function WeeklyReviewClient({ isPro }: WeeklyReviewClientProps) {
  const [lite, setLite] = useState<LiteData | null>(null);
  const [liteLoading, setLiteLoading] = useState(true);
  const [proReview, setProReview] = useState<ProReview | null>(null);
  const [proLoading, setProLoading] = useState(false);

  useEffect(() => {
    fetch("/api/weekly-review-lite")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setLite(data); })
      .catch(() => {})
      .finally(() => setLiteLoading(false));
  }, []);

  const handleGenerateProReview = async () => {
    setProLoading(true);
    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setProReview(data);
      }
    } catch {
      // skip
    } finally {
      setProLoading(false);
    }
  };

  if (liteLoading) {
    return <p className="text-center text-sm text-text2 py-12">読み込み中...</p>;
  }

  if (!lite) {
    return <p className="text-center text-text2">データの取得に失敗しました</p>;
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      {/* Period */}
      <p className="text-sm text-text3">
        {formatDate(lite.periodStart)} 〜 {formatDate(lite.periodEnd)}
      </p>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border-brand bg-surface p-4 text-center">
          <p className="text-3xl font-bold text-forest">{lite.totalDecisions}</p>
          <p className="mt-1 text-xs text-text2">判定回数</p>
        </div>
        <div className="rounded-lg border border-border-brand bg-surface p-4 text-center">
          <p className="text-3xl font-bold text-sky">{lite.uniqueDays}<span className="text-base font-normal text-text3"> / 7日</span></p>
          <p className="mt-1 text-xs text-text2">利用日数</p>
        </div>
        <div className="rounded-lg border border-border-brand bg-surface p-4 text-center">
          <p className="text-3xl font-bold text-amber">{lite.topTasks.length}</p>
          <p className="mt-1 text-xs text-text2">タスク種類</p>
        </div>
      </div>

      {/* Top tasks */}
      {lite.topTasks.length > 0 && (
        <div className="rounded-lg border border-border-brand bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text">よく判定したタスク</h2>
          <ul className="space-y-2">
            {lite.topTasks.map((task, i) => (
              <li key={task} className="flex items-center gap-2 text-sm text-text2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-bg text-xs font-medium text-forest">
                  {i + 1}
                </span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No data state */}
      {lite.totalDecisions === 0 && (
        <div className="rounded-lg border border-border-brand bg-surface p-8 text-center">
          <p className="text-text2">この7日間の判定データがありません</p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block rounded-lg bg-forest px-4 py-2 text-sm font-medium text-root-color hover:opacity-90 transition-opacity"
          >
            タスク判定を始める
          </Link>
        </div>
      )}

      {/* Pro section */}
      {isPro ? (
        <div className="rounded-lg border border-border-brand bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text">AIレビュー</h2>
          {proReview ? (
            <div className="prose prose-sm max-w-none">
              <MarkdownContent text={proReview.review} />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateProReview}
              disabled={proLoading}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-root-color hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {proLoading ? "生成中..." : "AIで詳細な振り返りを生成"}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-bd bg-amber-bg p-4">
          <p className="text-sm font-medium text-text">
            AIによる詳細な振り返りはProプランで利用できます
          </p>
          <p className="mt-1 text-xs text-text2">
            傾向分析・マイゴールとの整合チェック・来週の改善提案など
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-block rounded-lg bg-forest px-4 py-2 text-sm font-medium text-root-color hover:opacity-90 transition-opacity"
          >
            Proプランを見る
          </Link>
        </div>
      )}
    </div>
  );
}
