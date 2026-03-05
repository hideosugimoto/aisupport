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
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        APIキー管理（BYOK）
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        自分のAPIキーを登録すると、プラットフォームのキーの代わりに使用されます。
      </p>

      {apiKeys.length > 0 && (
        <div className="mb-4 space-y-2">
          {apiKeys.map((key) => (
            <div
              key={key.provider}
              className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {PROVIDER_LABELS[key.provider] ?? key.provider}
                </span>
                <span className="ml-2 font-mono text-xs text-zinc-400">
                  {key.keyHint}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteApiKey(key.provider)}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="api-key-provider" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            プロバイダー
          </label>
          <select
            id="api-key-provider"
            value={newKeyProvider}
            onChange={(e) => setNewKeyProvider(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>
        <div>
          <label htmlFor="api-key-input" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            APIキー
          </label>
          <input
            id="api-key-input"
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder="APIキーを入力..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="button"
          onClick={handleSaveApiKey}
          disabled={savingKey || !newKeyValue.trim()}
          aria-busy={savingKey}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {savingKey ? "保存中..." : "キーを保存"}
        </button>
      </div>
    </div>
  );
}
