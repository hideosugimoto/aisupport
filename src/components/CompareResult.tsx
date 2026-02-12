"use client";

import { MarkdownContent } from "./MarkdownContent";
import type { CompareResult } from "@/lib/compare/parallel-engine";

interface CompareResultProps {
  results: CompareResult[];
}

export function CompareResult({ results }: CompareResultProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        比較結果（{results.length}エンジン）
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <div
            key={result.provider}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {result.provider}
              </h3>
              {result.error ? (
                <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                  エラー
                </span>
              ) : (
                <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
                  成功
                </span>
              )}
            </div>

            {result.error ? (
              <div className="text-sm text-red-600 dark:text-red-400">
                {result.error}
              </div>
            ) : (
              <>
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none mb-3">
                  <MarkdownContent text={result.decision} />
                </div>

                <div className="space-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>所要時間</span>
                    <span className="font-medium">{result.durationMs}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>コスト</span>
                    <span className="font-medium">
                      ${result.costUsd.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>トークン</span>
                    <span className="font-medium">
                      {result.usage.inputTokens} / {result.usage.outputTokens}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>モデル</span>
                    <span className="truncate font-medium text-[10px]">
                      {result.model}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
