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
        <div className="rounded-lg border border-amber-bd bg-amber-bg p-3 text-sm text-amber-brand">
          低エネルギーモードで分解しています（より小さな粒度）
        </div>
      )}
      <div className="prose max-w-none rounded-lg border border-border-brand bg-bg p-6">
        <MarkdownContent text={content} />
      </div>
      <div className="flex gap-4 text-xs text-text3">
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
