"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PlanBillingSection } from "@/components/settings/PlanBillingSection";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { PushNotificationSection } from "@/components/settings/PushNotificationSection";
import { ReminderSection } from "@/components/settings/ReminderSection";
import { AccountDeletionSection } from "@/components/settings/AccountDeletionSection";

interface NotificationSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  budgetAlert: boolean;
  digestEnabled: boolean;
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    reminderEnabled: false,
    reminderTime: "09:00",
    budgetAlert: true,
    digestEnabled: true,
  });
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
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
            digestEnabled: data.digestEnabled ?? true,
          });
        }
      })
      .catch((err) => console.warn("[Settings] 通知設定取得失敗:", err instanceof Error ? err.message : String(err)));

    fetch("/api/billing/plan")
      .then((r) => r.json())
      .then((data) => {
        if (data.plan) setPlanInfo(data);
      })
      .catch((err) => console.warn("[Settings] プラン取得失敗:", err instanceof Error ? err.message : String(err)));

    fetch("/api/user/api-keys")
      .then((r) => r.json())
      .then((data) => {
        if (data.keys) setApiKeys(data.keys);
      })
      .catch((err) => console.warn("[Settings] APIキー取得失敗:", err instanceof Error ? err.message : String(err)));

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
          <PlanBillingSection
            planInfo={planInfo}
            upgrading={upgrading}
            onUpgrade={handleUpgrade}
            onManageBilling={handleManageBilling}
          />

          <ApiKeySection
            apiKeys={apiKeys}
            onKeysChange={setApiKeys}
            onMessage={setMessage}
          />

          <PushNotificationSection
            pushSupported={pushSupported}
            pushSubscribed={pushSubscribed}
            onSubscribe={subscribePush}
            onUnsubscribe={unsubscribePush}
          />

          <ReminderSection
            settings={settings}
            saving={saving}
            onSettingsChange={setSettings}
            onSave={saveSettings}
          />

          <AccountDeletionSection onMessage={setMessage} />

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
