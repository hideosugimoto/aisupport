"use client";

import { useState } from "react";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
};

interface ApiKeyInfo {
  provider: string;
  keyHint: string;
}

interface ApiKeySectionProps {
  apiKeys: ApiKeyInfo[];
  onKeysChange: (updater: (prev: ApiKeyInfo[]) => ApiKeyInfo[]) => void;
  onMessage: (message: string) => void;
}

export function ApiKeySection({ apiKeys, onKeysChange, onMessage }: ApiKeySectionProps) {
  const [newKeyProvider, setNewKeyProvider] = useState("openai");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!newKeyValue.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newKeyProvider, apiKey: newKeyValue }),
      });
      const data = await res.json();
      if (res.ok) {
        onKeysChange((prev) => {
          const filtered = prev.filter((k) => k.provider !== newKeyProvider);
          return [...filtered, { provider: data.provider, keyHint: data.keyHint }];
        });
        setNewKeyValue("");
        onMessage(`${PROVIDER_LABELS[newKeyProvider]}のAPIキーを保存しました`);
      } else {
        onMessage(data.error ?? "APIキーの保存に失敗しました");
      }
    } catch {
      onMessage("APIキーの保存に失敗しました");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async (provider: string) => {
    try {
      const params = new URLSearchParams({ provider });
      const res = await fetch(`/api/user/api-keys?${params}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onKeysChange((prev) => prev.filter((k) => k.provider !== provider));
        onMessage(`${PROVIDER_LABELS[provider]}のAPIキーを削除しました`);
      }
    } catch {
      onMessage("APIキーの削除に失敗しました");
    }
  };

  return (
    <div className="rounded-lg border border-border-brand bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium text-text">
        APIキー管理（BYOK）
      </h2>
      <p className="mb-4 text-xs text-text2">
        自分のAPIキーを登録すると、プラットフォームのキーの代わりに使用されます。
      </p>

      {apiKeys.length > 0 && (
        <div className="mb-4 space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.provider}
              className="flex items-center justify-between rounded-lg border border-border-brand bg-bg px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-text">
                  {PROVIDER_LABELS[key.provider] ?? key.provider}
                </span>
                <span className="ml-2 font-mono text-xs text-text3">
                  {key.keyHint}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteApiKey(key.provider)}
                className="text-xs text-amber-brand hover:text-amber-brand"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="api-key-provider" className="mb-1 block text-xs text-text2">
            プロバイダー
          </label>
          <select
            id="api-key-provider"
            value={newKeyProvider}
            onChange={(e) => setNewKeyProvider(e.target.value)}
            className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm"
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>
        <div>
          <label htmlFor="api-key-input" className="mb-1 block text-xs text-text2">
            APIキー
          </label>
          <input
            id="api-key-input"
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder="APIキーを入力..."
            className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSaveApiKey}
          disabled={savingKey || !newKeyValue.trim()}
          aria-busy={savingKey}
          className="w-full rounded-lg bg-root-bg px-4 py-2 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
        >
          {savingKey ? "保存中..." : "キーを保存"}
        </button>
      </div>
    </div>
  );
}
