"use client";

import { useState } from "react";

interface AccountDeletionSectionProps {
  onMessage: (message: string) => void;
}

export function AccountDeletionSection({ onMessage }: AccountDeletionSectionProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/sign-in";
        return;
      } else {
        const data = await res.json();
        onMessage(data.error ?? "アカウント削除に失敗しました");
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      onMessage("アカウント削除に失敗しました");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
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
        type="button"
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
  );
}
