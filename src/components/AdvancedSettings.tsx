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

  const modelLabels = featuresConfig.model_labels as Record<string, { name: string; description: string }>;
  const providerLabels = featuresConfig.provider_labels as Record<string, { name: string; description: string }>;

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
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="advanced-settings-provider-label">
              {featuresConfig.enabled_providers.map((p) => {
                const label = providerLabels[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onProviderChange(p)}
                    className={`rounded-lg px-4 py-3 text-left border transition-colors ${
                      provider === p
                        ? "bg-root-bg text-root-color border-root-bg"
                        : "border-border-brand text-text2 hover:bg-bg2"
                    }`}
                  >
                    <span className="block text-sm font-medium">{label?.name ?? p}</span>
                    {label && (
                      <span className={`block text-xs mt-0.5 ${provider === p ? "text-root-color/70" : "text-text3"}`}>
                        {label.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* モデル選択 */}
          <div>
            <span className="block text-sm font-medium text-text mb-2">
              モデル
            </span>
            <div className="space-y-2">
              {availableModels.map((m) => {
                const label = modelLabels[m];
                const isSelected = model === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onModelChange(m)}
                    className={`w-full rounded-lg px-4 py-3 text-left border transition-colors ${
                      isSelected
                        ? "border-forest bg-forest-bg"
                        : "border-border-brand hover:bg-bg2"
                    }`}
                  >
                    <span className={`block text-sm font-medium ${isSelected ? "text-forest" : "text-text"}`}>
                      {label?.name ?? m}
                    </span>
                    {label && (
                      <span className="block text-xs mt-0.5 text-text2">
                        {label.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
