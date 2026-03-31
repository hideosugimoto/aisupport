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
    <div className="rounded-lg border border-border-brand bg-surface p-4">
      <div className="space-y-1.5">
        {yesterdayTask && (
          <p className="text-sm text-text">
            昨日は「{yesterdayTask}」に取り組みました
          </p>
        )}
        {streakDays > 0 && (
          <p className="text-sm font-medium text-text">
            {streakDays}日連続で利用中
          </p>
        )}
        {todayCount > 0 && (
          <p className="text-xs text-text3">
            今日の判定: {todayCount}回
          </p>
        )}
      </div>
    </div>
  );
}
