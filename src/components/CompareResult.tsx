"use client";

import { MarkdownContent } from "./MarkdownContent";
import type { CompareResult as CompareResultType } from "@/lib/compare/parallel-engine";
import type { CompassRelevance } from "@/lib/compass/types";

interface CompareResultProps {
  results: CompareResultType[];
  compassRelevance?: CompassRelevance;
}

export function CompareResult({ results, compassRelevance }: CompareResultProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        比較結果（{results.length}エンジン）
      </h2>
      {compassRelevance?.hasCompass && compassRelevance.topMatches.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
            羅針盤を基準に比較しています
          </p>
          <div className="flex flex-wrap gap-2">
            {compassRelevance.topMatches.map((match) => (
              <span
                key={match.title}
                className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              >
                <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white dark:bg-blue-400 dark:text-blue-950" aria-hidden="true">C</span>
                {match.title} ({Math.round(match.similarity * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {!compassRelevance?.hasCompass && (
        <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <a href="/compass" className="underline hover:text-zinc-700 dark:hover:text-zinc-300" aria-label="羅針盤を登録すると、目標に基づいた比較ができます">
            羅針盤を登録
          </a>
          すると、目標に基づいた比較ができます
        </div>
      )}
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
