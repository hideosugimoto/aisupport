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
      <h2 className="mb-4 text-lg font-semibold text-text">
        比較結果（{results.length}エンジン）
      </h2>
      {compassRelevance?.hasCompass && compassRelevance.topMatches.length > 0 && (
        <div className="mb-4 rounded-lg border border-sky-bd bg-sky-bg p-4">
          <p className="mb-2 text-sm font-medium text-sky">
            マイゴールを基準に比較しています
          </p>
          <div className="flex flex-wrap gap-2">
            {compassRelevance.topMatches.map((match) => (
              <span
                key={match.title}
                className="inline-flex items-center rounded-full bg-sky-bg px-3 py-1 text-xs font-medium text-sky"
              >
                <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky text-[11px] font-bold text-root-color" aria-hidden="true">C</span>
                {match.title} ({Math.round(match.similarity * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {!compassRelevance?.hasCompass && (
        <div className="mb-4 rounded-lg border border-border-brand bg-bg p-3 text-sm text-text2">
          <a href="/compass" className="underline hover:text-text" aria-label="マイゴールを設定すると、目標に基づいた比較ができます">
            マイゴールを設定
          </a>
          すると、目標に基づいた比較ができます
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <div
            key={result.provider}
            className="rounded-lg border border-border-brand bg-surface p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text">
                {result.provider}
              </h3>
              {result.error ? (
                <span className="rounded bg-amber-bg px-2 py-1 text-xs font-medium text-amber-brand">
                  エラー
                </span>
              ) : (
                <span className="rounded bg-forest-bg px-2 py-1 text-xs font-medium text-forest">
                  成功
                </span>
              )}
            </div>

            {result.error ? (
              <div className="text-sm text-amber-brand">
                {result.error}
              </div>
            ) : (
              <>
                <div className="prose prose-sm max-w-none mb-3">
                  <MarkdownContent text={result.decision} />
                </div>

                <div className="space-y-1 border-t border-border-brand pt-3 text-xs text-text2">
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
                    <span className="truncate font-medium text-[11px]">
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
