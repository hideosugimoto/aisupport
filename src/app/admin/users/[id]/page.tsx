"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface UserDetail {
  id: string;
  email: string;
  createdAt: number;
  lastSignInAt: number | null;
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  suspended: boolean;
  suspendReason: string | null;
  totalUsage: number;
  lastActivity: string | null;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetch(`/api/admin/users/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSuspend = async () => {
    if (!confirm("このユーザーを停止しますか？")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, suspended: true, suspendReason: reason || null } : null);
        setReason("");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!confirm("このユーザーの停止を解除しますか？")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/unsuspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, suspended: false, suspendReason: null } : null);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-center text-sm text-text2 py-12">読み込み中...</p>;
  if (!user) return <p className="text-center text-sm text-text2 py-12">ユーザーが見つかりません</p>;

  const formatDate = (v: number | string | null) =>
    v ? new Date(v).toLocaleString("ja-JP") : "—";

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-text2 hover:text-text">
        ← ユーザー一覧
      </Link>

      <div className="rounded-lg border border-border-brand bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text">基本情報</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-text3">メール</dt>
            <dd className="font-medium text-text">{user.email}</dd>
          </div>
          <div>
            <dt className="text-text3">ユーザーID</dt>
            <dd className="font-mono text-xs text-text2">{user.id}</dd>
          </div>
          <div>
            <dt className="text-text3">登録日時</dt>
            <dd className="text-text">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-text3">最終ログイン</dt>
            <dd className="text-text">{formatDate(user.lastSignInAt)}</dd>
          </div>
          <div>
            <dt className="text-text3">最終利用日時</dt>
            <dd className="text-text">{formatDate(user.lastActivity)}</dd>
          </div>
          <div>
            <dt className="text-text3">累計リクエスト</dt>
            <dd className="text-text">{user.totalUsage}回</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border-brand bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text">プラン・課金</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-text3">プラン</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                user.plan === "pro" ? "bg-forest-bg text-forest" : "bg-stone-bg text-stone"
              }`}>
                {user.plan === "pro" ? "Pro" : "Free"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-text3">Stripe顧客ID</dt>
            <dd className="font-mono text-xs text-text2">{user.stripeCustomerId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text3">サブスクリプションID</dt>
            <dd className="font-mono text-xs text-text2">{user.stripeSubscriptionId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text3">サブスク状態</dt>
            <dd className="text-text">{user.subscriptionStatus ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border-brand bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-text">アカウント管理</h2>

        {user.suspended ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-bg p-3">
              <p className="text-sm font-medium text-amber">このアカウントは停止中です</p>
              {user.suspendReason && (
                <p className="mt-1 text-xs text-text2">理由: {user.suspendReason}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleUnsuspend}
              disabled={actionLoading}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-root-color hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionLoading ? "処理中..." : "停止を解除する"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="停止理由（任意）"
              className="w-full rounded-lg border border-border-brand bg-bg px-3 py-2 text-sm text-text placeholder:text-text3 focus:outline-none focus:border-forest"
            />
            <button
              type="button"
              onClick={handleSuspend}
              disabled={actionLoading}
              className="rounded-lg border border-amber-bd bg-amber-bg px-4 py-2 text-sm font-medium text-amber hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionLoading ? "処理中..." : "アカウントを停止する"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
