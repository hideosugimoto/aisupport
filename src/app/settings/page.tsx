"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface NotificationSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  budgetAlert: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    reminderEnabled: false,
    reminderTime: "09:00",
    budgetAlert: true,
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check push support
    setPushSupported("serviceWorker" in navigator && "PushManager" in window);

    // Load settings
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

    // Check subscription status
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushSubscribed(!!sub);
        });
      });
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
      }
    } catch {
      setMessage("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              通知設定
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定
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
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  毎日のリマインダー
                </span>
                <input
                  type="checkbox"
                  checked={settings.reminderEnabled}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, reminderEnabled: e.target.checked }))
                  }
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </label>

              {settings.reminderEnabled && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    通知時刻
                  </label>
                  <input
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, reminderTime: e.target.value }))
                    }
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              )}

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    予算アラート
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    月間予算の80%を超えたら通知
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.budgetAlert}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, budgetAlert: e.target.checked }))
                  }
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
              </label>
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
