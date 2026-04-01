"use client";

import { ChatMessage } from "../ChatMessage";
import { AdvancedSettings } from "../AdvancedSettings";

const ENERGY_LABELS = [
  "",
  "ぐったり",
  "まあまあ",
  "普通",
  "元気",
  "やる気MAX",
] as const;

interface ChatConfirmStepProps {
  tasks: string[];
  availableTime: number;
  energyLevel: number;
  provider: string;
  model: string;
  autoFallback: boolean;
  isSubmitting: boolean;
  canSelectModel?: boolean;
  onSubmit: () => void;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onFallbackChange: (enabled: boolean) => void;
}

export function ChatConfirmStep({
  tasks,
  availableTime,
  energyLevel,
  provider,
  model,
  autoFallback,
  isSubmitting,
  canSelectModel,
  onSubmit,
  onProviderChange,
  onModelChange,
  onFallbackChange,
}: ChatConfirmStepProps) {
  return (
    <div className="space-y-4">
      <ChatMessage>
        <div className="space-y-3">
          <p>準備完了です。</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="mr-1 font-medium text-text2" aria-hidden="true">[T]</span>
              タスク: {tasks.join("、")}
            </p>
            <p>
              <span className="mr-1 font-medium text-text2" aria-hidden="true">[t]</span>
              時間: {availableTime}分
            </p>
            <p>
              <span className="mr-1 font-medium text-text2" aria-hidden="true">[E]</span>
              エネルギー: {energyLevel} {ENERGY_LABELS[energyLevel]}
            </p>
          </div>
        </div>
      </ChatMessage>

      <div className="ml-11 space-y-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full rounded-lg bg-root-bg px-4 py-3 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
        >
          {isSubmitting ? "判断中..." : "最適なタスクを判断する"}
        </button>

        {canSelectModel && (
          <AdvancedSettings
            provider={provider}
            model={model}
            autoFallback={autoFallback}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onFallbackChange={onFallbackChange}
          />
        )}
      </div>
    </div>
  );
}
