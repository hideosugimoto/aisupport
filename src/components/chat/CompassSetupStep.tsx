"use client";

import { ChatMessage } from "../ChatMessage";

interface CompassSetupStepProps {
  compassInput: string;
  compassDrafts: string[];
  compassSaving: boolean;
  onInputChange: (value: string) => void;
  onAddDraft: () => void;
  onAddPreset?: (value: string) => void;
  onRemoveDraft: (index: number) => void;
  onSave: () => void;
  onSkip: () => void;
}

const PRESET_GOALS = [
  { label: "収入UP", value: "収入を上げたい" },
  { label: "スキルアップ", value: "スキルを磨きたい" },
  { label: "健康改善", value: "健康的な生活を送りたい" },
  { label: "自由時間", value: "自由な時間を増やしたい" },
] as const;

export function CompassSetupStep({
  compassInput,
  compassDrafts,
  compassSaving,
  onInputChange,
  onAddDraft,
  onAddPreset,
  onRemoveDraft,
  onSave,
  onSkip,
}: CompassSetupStepProps) {
  const handlePresetClick = (value: string) => {
    if (onAddPreset) {
      onAddPreset(value);
    } else {
      onInputChange(value);
      onAddDraft();
    }
  };

  return (
    <div className="space-y-4">
      <ChatMessage>
        <div className="space-y-2">
          <p>はじめまして。AI意思決定アシスタントです。</p>
          <p>
            あなたの目標や夢を教えてください。
            「将来やりたいこと」「ワクワクすること」など、何でも構いません。
          </p>
          <p>
            これを「マイゴール」として、日々のタスク選びの基準にします。
          </p>
        </div>
      </ChatMessage>

      <div className="ml-11 space-y-3">
        {/* Preset goals */}
        {compassDrafts.length === 0 && (
          <div>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              タップで選ぶか、自分で入力してください
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_GOALS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetClick(preset.value)}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={compassInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddDraft();
              }
            }}
            placeholder="例: 海外で暮らしたい"
            maxLength={200}
            aria-label="マイゴールを入力"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
          />
          <button
            type="button"
            onClick={onAddDraft}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            追加
          </button>
        </div>

        {compassDrafts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {compassDrafts.map((draft, index) => (
              <span
                key={`draft-${draft}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {draft}
                <button
                  type="button"
                  onClick={() => onRemoveDraft(index)}
                  aria-label={`${draft} を削除`}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {compassDrafts.length > 0 && (
            <button
              type="button"
              onClick={onSave}
              disabled={compassSaving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {compassSaving ? "保存中..." : "マイゴールに登録"}
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            スキップして先にタスク判定する
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          写真やURLも登録できます →{" "}
          <a href="/compass" className="underline hover:text-zinc-600 dark:hover:text-zinc-200">
            マイゴールページへ
          </a>
        </p>
      </div>
    </div>
  );
}
