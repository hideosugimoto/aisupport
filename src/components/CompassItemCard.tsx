"use client";

import { useState } from "react";

interface CompassItemProps {
  item: {
    id: number;
    type: string;
    title: string;
    content: string;
    sourceUrl?: string | null;
    createdAt: string;
    chunkCount: number;
  };
  onDelete: (id: number) => void;
}

export function CompassItemCard({ item, onDelete }: CompassItemProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/compass/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(item.id);
      } else {
        console.warn("[Compass] 削除失敗:", res.status);
      }
    } catch (err) {
      console.warn("[Compass] 削除エラー:", err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const typeLabel = item.type === "text" ? "TXT" : item.type === "url" ? "URL" : "IMG";
  const truncatedContent = item.content.length > 100 ? item.content.slice(0, 100) + "…" : item.content;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-zinc-200 text-[10px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" aria-hidden="true">{typeLabel}</span>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </h3>
        </div>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`${item.title}を削除`}
            className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
          >
            削除
          </button>
        ) : (
          <div className="flex gap-1" role="group" aria-label="削除確認">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting}
              aria-label={`${item.title}を削除`}
              className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {deleting ? "削除中..." : "確認"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              aria-label="削除をキャンセル"
              className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
        {truncatedContent}
      </p>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {item.sourceUrl}
        </a>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {item.chunkCount}チャンク
        </span>
        <time dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
    </div>
  );
}
