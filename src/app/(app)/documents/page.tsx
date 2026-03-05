"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Document {
  id: number;
  filename: string;
  mimeType: string;
  chunkCount: number;
  createdAt: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      setError("ドキュメント一覧の取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "アップロード失敗");
        return;
      }

      setSuccess(`${data.filename} をアップロードしました（${data.chunkCount}チャンク）`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } catch {
      setError("アップロード中にエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "削除失敗");
        return;
      }
      fetchDocuments();
    } catch {
      setError("削除中にエラーが発生しました");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              ドキュメント管理
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定
              </Link>
              <Link
                href="/compass"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                羅針盤
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            RAG用ドキュメントをアップロードして判定精度を向上させます
          </p>
        </header>

        {/* Upload form */}
        <form
          onSubmit={handleUpload}
          className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <label htmlFor="file-upload" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ファイルアップロード
          </label>
          <p id="file-upload-hint" className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            対応形式: Markdown (.md), テキスト (.txt), PDF (.pdf)
          </p>
          <div className="flex gap-2">
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf"
              aria-describedby="file-upload-hint"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {uploading ? "処理中..." : "アップロード"}
            </button>
          </div>
        </form>

        {/* Messages */}
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            {success}
          </div>
        )}

        {/* Document list */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              アップロード済みドキュメント ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              ドキュメントがありません
            </div>
          ) : (
            <ul>
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {doc.chunkCount}チャンク &middot;{" "}
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  {confirmDeleteId === doc.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        aria-label={`${doc.filename}の削除を確認`}
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        確認
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="削除をキャンセル"
                        className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      aria-label={`${doc.filename}を削除`}
                      className="rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      削除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
