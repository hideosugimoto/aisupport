"use client";

import { useEffect, useState } from "react";

interface CompassSuggestion {
  compassItemId: number;
  compassTitle: string;
  suggestedTask: string;
  reason: string;
  timeEstimate: number;
}

interface CompassSuggestionCardProps {
  suggestion: CompassSuggestion | null;
  loading: boolean;
  onAddTask: (task: string) => void;
}

export function CompassSuggestionCard({
  suggestion,
  loading,
  onAddTask,
}: CompassSuggestionCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (suggestion) {
      const id = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [suggestion]);

  if (!suggestion && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">🧭</span>
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200">
            Compass提案を生成中...
          </span>
        </div>
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Compass提案を生成中">
          <div className="h-3 w-3/4 animate-pulse rounded bg-teal-200 dark:bg-teal-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-teal-200 dark:bg-teal-800" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950 motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "motion-safe:opacity-0 motion-safe:translate-y-2"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base" aria-hidden="true">🧭</span>
        <span className="text-sm font-medium text-teal-800 dark:text-teal-200">
          Compassからの提案
        </span>
      </div>

      {/* Neglected dream notice */}
      <p className="mb-3 text-sm text-teal-700 dark:text-teal-300">
        「{suggestion!.compassTitle}」に最近取り組めていません
      </p>

      {/* Suggested task */}
      <p className="mb-2 text-sm font-semibold text-teal-900 dark:text-teal-100">
        <span aria-hidden="true">💡</span>{" "}
        {suggestion!.suggestedTask}
        <span className="ml-1 font-normal text-teal-600 dark:text-teal-400">
          （約{suggestion!.timeEstimate}分）
        </span>
      </p>

      {/* Reason */}
      <p className="mb-4 text-sm text-teal-700 dark:text-teal-300">
        {suggestion!.reason}
      </p>

      {/* CTA button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onAddTask(suggestion!.suggestedTask)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400"
        >
          このタスクを追加して再判断
        </button>
      </div>
    </div>
  );
}
