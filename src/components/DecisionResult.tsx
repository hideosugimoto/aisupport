"use client";

import { MarkdownContent } from "./MarkdownContent";
import type { CompassRelevance } from "@/lib/compass/types";
import type { DecisionContextHints } from "@/lib/decision/task-decision-engine";

interface DecisionResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  remaining?: number;
  onBreakdown?: (task: string) => void;
  onShare?: () => void;
  sharing?: boolean;
  shareUrl?: string;
  compassRelevance?: CompassRelevance;
  contextHints?: DecisionContextHints;
}

export function DecisionResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
  remaining,
  onBreakdown,
  onShare,
  sharing,
  shareUrl,
  compassRelevance,
  contextHints,
}: DecisionResultProps) {
  const taskMatch = content.match(/### 今日の最適タスク\n(.+)/);
  const selectedTask = taskMatch?.[1]?.trim() ?? "";

  return (
    <div className="mt-6 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-bd bg-amber-bg p-3 text-sm text-amber-brand">
          低エネルギーモードで回答しています
        </div>
      )}
      <div className="prose max-w-none rounded-lg border border-border-brand bg-surface p-6">
        <MarkdownContent text={content} />
      </div>
      {compassRelevance?.hasCompass && compassRelevance.topMatches.length > 0 && (
        <div className="rounded-lg border border-sky-bd bg-sky-bg p-4">
          <p className="mb-2 text-sm font-medium text-sky">
            マイゴールとの関連
          </p>
          <div className="flex flex-wrap gap-2">
            {compassRelevance.topMatches.map((match) => (
              <span
                key={match.title}
                className="inline-flex items-center rounded-full bg-sky-bg px-3 py-1 text-xs font-medium text-sky"
              >
                <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky text-[11px] font-bold text-root-color" aria-hidden="true">G</span>
                {match.title} ({Math.round(match.similarity * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {!compassRelevance?.hasCompass && (
        <div className="rounded-lg border border-sky-bd bg-sky-bg p-4">
          <p className="text-sm text-sky">
            マイゴールを設定すると、もっと的確な判定ができます
          </p>
          <a
            href="/compass"
            className="mt-2 inline-block rounded-lg bg-sky px-4 py-1.5 text-sm font-medium text-root-color hover:opacity-90 transition-colors"
            aria-label="マイゴールを設定する"
          >
            マイゴールを設定する
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-xs text-text3">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
        {contextHints && (
          <span className="flex gap-2">
            {contextHints.hasCompass && (
              <span className="rounded bg-sky-bg px-1.5 py-0.5 text-sky">マイゴール</span>
            )}
            {contextHints.hasRag && (
              <span className="rounded bg-forest-bg px-1.5 py-0.5 text-forest">RAG</span>
            )}
          </span>
        )}
        {remaining !== undefined && remaining >= 0 && (
          <span className={remaining <= 3 ? "font-medium text-amber-brand" : ""}>
            残り {remaining} 回 / 今月
          </span>
        )}
      </div>
      {onShare && !shareUrl && (
        <button
          type="button"
          onClick={onShare}
          disabled={sharing}
          className="rounded-lg border border-border-brand px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg2 disabled:opacity-50"
        >
          {sharing ? "共有リンクを作成中..." : "結果を共有する"}
        </button>
      )}
      {shareUrl && (
        <div className="rounded-lg border border-border-brand bg-surface p-4 space-y-3">
          <p className="text-xs text-text2">
            共有リンクが作成されました（30日間有効・誰でも閲覧可能）
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(shareUrl); }}
              className="rounded-lg border border-border-brand px-3 py-1.5 text-xs font-medium text-text hover:bg-bg2 transition-colors"
            >
              リンクをコピー
            </button>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("AIが今日の最適タスクを判定しました")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border-brand px-3 py-1.5 text-xs font-medium text-text hover:bg-bg2 transition-colors"
            >
              X(Twitter)
            </a>
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border-brand px-3 py-1.5 text-xs font-medium text-text hover:bg-bg2 transition-colors"
            >
              LINE
            </a>
          </div>
        </div>
      )}
      {onBreakdown && selectedTask && (
        <button
          type="button"
          onClick={() => onBreakdown(selectedTask)}
          className="rounded-lg border border-border-brand px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg2"
        >
          このタスクを分解する
        </button>
      )}
    </div>
  );
}
