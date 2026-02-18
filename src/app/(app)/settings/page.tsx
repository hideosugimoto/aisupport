"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import plansConfig from "../../../../config/plans.json";

interface NotificationSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  budgetAlert: boolean;
}

interface PlanInfo {
  plan: string;
  monthlyRequestLimit: number;
  ragEnabled: boolean;
  weeklyReviewEnabled: boolean;
  remaining: number;
}

interface ApiKeyInfo {
  provider: string;
  keyHint: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    reminderEnabled: false,
    reminderTime: "09:00",
    budgetAlert: true,
  });
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState("openai");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);

    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.reminderEnabled !== undefined) {
          setSettings({
            reminderEnabled: data.reminderEnabled,
            reminderTime: data.reminderTime,
            budgetAlert: data.budgetAlert,
          });
        }
      })
      .catch(() => {});

    fetch("/api/billing/plan")
      .then((r) => r.json())
      .then((data) => {
        if (data.plan) setPlanInfo(data);
      })
      .catch(() => {});

    fetch("/api/user/api-keys")
      .then((r) => r.json())
      .then((data) => {
        if (data.keys) setApiKeys(data.keys);
      })
      .catch(() => {});

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(!!sub);
        });
      });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setMessage("Proプランへのアップグレード処理中...");
      // Webhook処理完了を待つためリトライ付きでプラン取得
      const pollPlan = async (retries: number) => {
        for (let i = 0; i < retries; i++) {
          try {
            const r = await fetch("/api/billing/plan");
            const data = await r.json();
            if (data.plan === "pro") {
              setPlanInfo(data);
              setMessage("Proプランへのアップグレードが完了しました！");
              return;
            }
          } catch { /* retry */ }
          if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000));
        }
        setMessage("Proプランへのアップグレードが完了しました！反映に数秒かかる場合があります。");
      };
      pollPlan(5);
    } else if (params.get("checkout") === "cancel") {
      setMessage("チェックアウトがキャンセルされました");
    }
  }, []);

  const subscribePush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setMessage("VAPID公開鍵が設定されていません");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (res.ok) {
        setPushSubscribed(true);
        setMessage("プッシュ通知を有効にしました");
      }
    } catch {
      setMessage("プッシュ通知の有効化に失敗しました");
    }
  }, []);

  const unsubscribePush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setPushSubscribed(false);
      setMessage("プッシュ通知を無効にしました");
    } catch {
      setMessage("プッシュ通知の無効化に失敗しました");
    }
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage("設定を保存しました");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "設定の保存に失敗しました");
      }
    } catch {
      setMessage("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error ?? "チェックアウトの開始に失敗しました");
        setUpgrading(false);
      }
    } catch {
      setMessage("チェックアウトの開始に失敗しました");
      setUpgrading(false);
    }
  };

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
        setApiKeys((prev) => {
          const filtered = prev.filter((k) => k.provider !== newKeyProvider);
          return [...filtered, { provider: data.provider, keyHint: data.keyHint }];
        });
        setNewKeyValue("");
        setMessage(`${PROVIDER_LABELS[newKeyProvider]}のAPIキーを保存しました`);
      } else {
        setMessage(data.error ?? "APIキーの保存に失敗しました");
      }
    } catch {
      setMessage("APIキーの保存に失敗しました");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async (provider: string) => {
    try {
      const res = await fetch(`/api/user/api-keys?provider=${provider}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.provider !== provider));
        setMessage(`${PROVIDER_LABELS[provider]}のAPIキーを削除しました`);
      }
    } catch {
      setMessage("APIキーの削除に失敗しました");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (res.ok) {
        // Clerk ユーザーは API 側で削除済み。sign-in に遷移してセッションをクリア
        window.location.href = "/sign-in";
        return;
      } else {
        const data = await res.json();
        setMessage(data.error ?? "アカウント削除に失敗しました");
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setMessage("アカウント削除に失敗しました");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error ?? "ポータルの表示に失敗しました");
      }
    } catch {
      setMessage("ポータルの表示に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              設定
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ダッシュボード
              </Link>
            </nav>
          </div>
        </header>

        {message && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Plan & Billing */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              プラン・課金
            </h2>

            {planInfo ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      現在のプラン
                    </p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {planInfo.plan === "pro" ? "Pro" : "Free"}
                    </p>
                  </div>
                  {planInfo.plan === "pro" ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                      有効
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      無料
                    </span>
                  )}
                </div>

                {planInfo.plan === "free" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        今月のリクエスト残数
                      </span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {planInfo.remaining} / {planInfo.monthlyRequestLimit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
                        style={{
                          width: `${Math.min(100, ((planInfo.monthlyRequestLimit - planInfo.remaining) / planInfo.monthlyRequestLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  <p>
                    RAG（ドキュメント検索）:{" "}
                    <span className={planInfo.ragEnabled ? "text-green-600 dark:text-green-400" : ""}>
                      {planInfo.ragEnabled ? "有効" : "Proプランで利用可"}
                    </span>
                  </p>
                  <p>
                    週次レビュー:{" "}
                    <span className={planInfo.weeklyReviewEnabled ? "text-green-600 dark:text-green-400" : ""}>
                      {planInfo.weeklyReviewEnabled ? "有効" : "Proプランで利用可"}
                    </span>
                  </p>
                </div>

                {planInfo.plan === "free" ? (
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    aria-busy={upgrading}
                    className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {upgrading ? "処理中..." : `Proプランにアップグレード (月額${plansConfig.plans.pro.price_jpy}円)`}
                  </button>
                ) : (
                  <button
                    onClick={handleManageBilling}
                    className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    課金管理（Stripeポータル）
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                プラン情報を読み込み中...
              </p>
            )}
          </div>

          {/* API Key Management */}
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
                onClick={handleSaveApiKey}
                disabled={savingKey || !newKeyValue.trim()}
                aria-busy={savingKey}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {savingKey ? "保存中..." : "キーを保存"}
              </button>
            </div>
          </div>

          {/* Push notification toggle */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              プッシュ通知
            </h2>

            {!pushSupported ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                このブラウザはプッシュ通知に対応していません
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    ブラウザ通知
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    リマインダーや予算アラートを受信
                  </p>
                </div>
                <button
                  onClick={pushSubscribed ? unsubscribePush : subscribePush}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    pushSubscribed
                      ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
                      : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                  }`}
                >
                  {pushSubscribed ? "無効にする" : "有効にする"}
                </button>
              </div>
            )}
          </div>

          {/* Reminder settings */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              リマインダー
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="reminder-enabled" className="text-sm text-zinc-700 dark:text-zinc-300">
                  毎日のリマインダー
                </label>
                <input
                  id="reminder-enabled"
                  type="checkbox"
                  checked={settings.reminderEnabled}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, reminderEnabled: e.target.checked }))
                  }
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </div>

              {settings.reminderEnabled && (
                <div>
                  <label htmlFor="reminder-time" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    通知時刻
                  </label>
                  <input
                    id="reminder-time"
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, reminderTime: e.target.value }))
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="budget-alert" className="text-sm text-zinc-700 dark:text-zinc-300">
                    予算アラート
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    月間予算の80%を超えたら通知
                  </p>
                </div>
                <input
                  id="budget-alert"
                  type="checkbox"
                  checked={settings.budgetAlert}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, budgetAlert: e.target.checked }))
                  }
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            aria-busy={saving}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "保存中..." : "通知設定を保存"}
          </button>

          {/* Account deletion */}
          <div className="rounded-lg border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">
              アカウント削除
            </h2>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              アカウントを削除すると、全データが完全に消去されます。この操作は取り消せません。
            </p>
            {confirmDelete && (
              <p role="alert" aria-live="assertive" className="mb-3 text-xs font-medium text-red-600 dark:text-red-400">
                本当に削除しますか？もう一度ボタンを押すと削除されます。
              </p>
            )}
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              aria-busy={deleting}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {deleting
                ? "削除中..."
                : confirmDelete
                  ? "本当に削除する"
                  : "アカウントを削除"}
            </button>
          </div>

          {/* Footer links */}
          <div className="flex justify-center gap-4 pt-4 text-xs text-zinc-400 dark:text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
