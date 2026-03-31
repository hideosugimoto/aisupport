"use client";

import { useEffect, useState } from "react";

interface DailySummary {
  yesterdayTask: string | null;
  streakDays: number;
  todayCount: number;
}

export function DailySummaryBanner() {
  const [summary, setSummary] = useState<DailySummary | null>(null);

  useEffect(() => {
    fetch("/api/daily-summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const { yesterdayTask, streakDays, todayCount } = summary;

  // 何もデータがなければ表示しない
  if (!yesterdayTask && streakDays === 0 && todayCount === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="space-y-1.5">
        {yesterdayTask && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            昨日は「{yesterdayTask}」に取り組みました
          </p>
        )}
        {streakDays > 0 && (
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {streakDays}日連続で利用中
          </p>
        )}
        {todayCount > 0 && (
          <p className="text-xs text-zinc-400">
            今日の判定: {todayCount}回
          </p>
        )}
      </div>
    </div>
  );
}
