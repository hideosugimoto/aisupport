"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminUser {
  id: string;
  email: string;
  createdAt: number;
  lastSignInAt: number | null;
  plan: string;
  suspended: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => {
        if (!res.ok) throw new Error("アクセスが拒否されました");
        return res.json();
      })
      .then((data) => setUsers(data.users ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-text2">読み込み中...</p>;
  if (error) return <p className="text-center text-amber-brand">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">ユーザー一覧</h2>
        <span className="text-sm text-text3">{users.length}件</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-brand">
        <table className="w-full text-sm">
          <thead className="bg-bg2 text-left text-text2">
            <tr>
              <th className="px-4 py-3 font-medium">メール</th>
              <th className="px-4 py-3 font-medium">登録日</th>
              <th className="px-4 py-3 font-medium">最終ログイン</th>
              <th className="px-4 py-3 font-medium">プラン</th>
              <th className="px-4 py-3 font-medium">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-brand bg-surface">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-bg2 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${user.id}`} className="text-forest hover:underline">
                    {user.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text2">
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3 text-text2">
                  {user.lastSignInAt
                    ? new Date(user.lastSignInAt).toLocaleDateString("ja-JP")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.plan === "pro"
                      ? "bg-forest-bg text-forest"
                      : "bg-stone-bg text-stone"
                  }`}>
                    {user.plan === "pro" ? "Pro" : "Free"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.suspended ? (
                    <span className="rounded-full bg-amber-bg px-2 py-0.5 text-xs font-medium text-amber">
                      停止中
                    </span>
                  ) : (
                    <span className="rounded-full bg-forest-bg px-2 py-0.5 text-xs font-medium text-forest">
                      有効
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
