"use client";

import { MarkdownContent } from "./MarkdownContent";

interface BreakdownResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function BreakdownResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
}: BreakdownResultProps) {
  return (
    <div className="mt-4 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          低エネルギーモードで分解しています（より小さな粒度）
        </div>
      )}
      <div className="prose prose-zinc dark:prose-invert max-w-none rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <MarkdownContent text={content} />
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
      </div>
    </div>
  );
}
