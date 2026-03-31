"use client";

import { useEffect, useState } from "react";
import type { CompassSuggestion } from "@/lib/compass/compass-suggester";

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
      <div className="rounded-lg border border-moss-bd bg-moss-bg p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-moss text-[10px] font-bold text-root-color" aria-hidden="true">C</span>
          <span className="text-sm font-medium text-moss">
            Compass提案を生成中...
          </span>
        </div>
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Compass提案を生成中">
          <div className="h-3 w-3/4 animate-pulse rounded bg-moss-bg" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-moss-bg" />
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-moss-bd bg-moss-bg p-4 motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "motion-safe:opacity-0 motion-safe:translate-y-2"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-moss text-[10px] font-bold text-root-color" aria-hidden="true">C</span>
        <span className="text-sm font-medium text-moss">
          Compassからの提案
        </span>
      </div>

      {/* Neglected dream notice */}
      <p className="mb-3 text-sm text-moss">
        「{suggestion.compassTitle}」に最近取り組めていません
      </p>

      {/* Suggested task */}
      <p className="mb-2 text-sm font-semibold text-moss">
        <span className="font-normal text-moss" aria-hidden="true">*</span>{" "}
        {suggestion.suggestedTask}
        <span className="ml-1 font-normal text-moss">
          （約{suggestion.timeEstimate}分）
        </span>
      </p>

      {/* Reason */}
      <p className="mb-4 text-sm text-moss">
        {suggestion.reason}
      </p>

      {/* CTA button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onAddTask(suggestion.suggestedTask)}
          className="rounded-lg bg-moss px-4 py-2 text-sm font-medium text-root-color transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2"
        >
          このタスクを追加して再判断
        </button>
      </div>
    </div>
  );
}
