"use client";

import { useEffect, useState } from "react";

interface AdminLogEntry {
  id: number;
  adminId: string;
  action: string;
  targetId: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  user_suspend: "ユーザー停止",
  user_unsuspend: "停止解除",
  admin_login: "管理者ログイン",
  admin_login_failed: "ログイン失敗",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/logs")
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => setLogs(data.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-text2">読み込み中...</p>;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-text">管理者操作ログ</h2>

      {logs.length === 0 ? (
        <p className="text-center text-text2 py-8">操作ログはまだありません</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-brand">
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-left text-text2">
              <tr>
                <th className="px-4 py-3 font-medium">日時</th>
                <th className="px-4 py-3 font-medium">操作</th>
                <th className="px-4 py-3 font-medium">対象</th>
                <th className="px-4 py-3 font-medium">詳細</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-brand bg-surface">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-text2 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3 text-text">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text2">
                    {log.targetId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-text2">
                    {log.detail ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text3">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
