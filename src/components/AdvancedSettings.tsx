"use client";

import { useState } from "react";
import featuresConfig from "../../config/features.json";

interface AdvancedSettingsProps {
  provider: string;
  model: string;
  autoFallback: boolean;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onFallbackChange: (enabled: boolean) => void;
}

export function AdvancedSettings({
  provider,
  model,
  autoFallback,
  onProviderChange,
  onModelChange,
  onFallbackChange,
}: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableModels =
    featuresConfig.available_models[
      provider as keyof typeof featuresConfig.available_models
    ] ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full text-left rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50 transition-colors"
      >
        {isOpen ? "⚙️ 詳細設定 ▲" : "⚙️ 詳細設定 ▼"}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {/* AIエンジン選択 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              AIエンジン
            </label>
            <div className="flex gap-2">
              {featuresConfig.enabled_providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onProviderChange(p)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                    provider === p
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* モデル選択 */}
          <div>
            <label
              htmlFor="advanced-settings-model"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              モデル
            </label>
            <select
              id="advanced-settings-model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 自動フォールバック */}
          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoFallback}
                onChange={(e) => onFallbackChange(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              自動フォールバック（エラー時に他のエンジンに切り替え）
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
