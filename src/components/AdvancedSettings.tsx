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
        className="w-full text-left rounded-lg border border-border-brand px-4 py-3 text-sm text-text2 hover:bg-bg transition-colors"
      >
        {isOpen ? "詳細設定 ▲" : "詳細設定 ▼"}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {/* AIエンジン選択 */}
          <div>
            <span id="advanced-settings-provider-label" className="block text-sm font-medium text-text mb-2">
              AIエンジン
            </span>
            <div className="flex gap-2" role="group" aria-labelledby="advanced-settings-provider-label">
              {featuresConfig.enabled_providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onProviderChange(p)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                    provider === p
                      ? "bg-root-bg text-root-color border-root-bg"
                      : "border-border-brand text-text2 hover:bg-bg2"
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
              className="block text-sm font-medium text-text mb-2"
            >
              モデル
            </label>
            <select
              id="advanced-settings-model"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full rounded-lg border border-border-brand px-3 py-2.5 text-sm"
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
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={autoFallback}
                onChange={(e) => onFallbackChange(e.target.checked)}
                className="rounded border-border-brand"
              />
              自動フォールバック（エラー時に他のエンジンに切り替え）
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
