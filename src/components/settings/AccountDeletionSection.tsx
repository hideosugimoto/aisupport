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
    <div className="rounded-lg border border-amber-bd bg-surface p-6">
      <h2 className="mb-2 text-sm font-medium text-amber-brand">
        アカウント削除
      </h2>
      <p className="mb-4 text-xs text-text2">
        アカウントを削除すると、全データが完全に消去されます。この操作は取り消せません。
      </p>
      {confirmDelete && (
        <p role="alert" aria-live="assertive" className="mb-3 text-xs font-medium text-amber-brand">
          本当に削除しますか？もう一度ボタンを押すと削除されます。
        </p>
      )}
      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={deleting}
        aria-busy={deleting}
        className="w-full rounded-lg bg-amber-brand px-4 py-2 text-sm font-medium text-root-color transition-colors hover:opacity-90 disabled:opacity-50"
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
