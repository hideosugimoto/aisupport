"use client";

import { MarkdownContent } from "./MarkdownContent";

interface CompassMatch {
  title: string;
  similarity: number;
}

interface DecisionResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  onBreakdown?: (task: string) => void;
  compassRelevance?: {
    hasCompass: boolean;
    topMatches: CompassMatch[];
  };
}

export function DecisionResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
  onBreakdown,
  compassRelevance,
}: DecisionResultProps) {
  const taskMatch = content.match(/### 今日の最適タスク\n(.+)/);
  const selectedTask = taskMatch?.[1]?.trim() ?? "";

  return (
    <div className="mt-6 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          低エネルギーモードで回答しています
        </div>
      )}
      <div className="prose prose-zinc dark:prose-invert max-w-none rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <MarkdownContent text={content} />
      </div>
      {compassRelevance?.hasCompass && compassRelevance.topMatches.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
            羅針盤との関連
          </p>
          <div className="flex flex-wrap gap-2">
            {compassRelevance.topMatches.map((match) => (
              <span
                key={match.title}
                className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              >
                <span className="mr-1" aria-hidden="true">🧭</span>
                {match.title} ({Math.round(match.similarity * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {!compassRelevance?.hasCompass && (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <a href="/compass" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
            羅針盤を登録
          </a>
          すると、目標に基づいた判定ができます
        </div>
      )}
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
      </div>
      {onBreakdown && selectedTask && (
        <button
          type="button"
          onClick={() => onBreakdown(selectedTask)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          このタスクを分解する
        </button>
      )}
    </div>
  );
}
