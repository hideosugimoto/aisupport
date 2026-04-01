"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SubNav } from "@/components/SubNav";

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
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              ドキュメント管理
            </h1>
            <SubNav links={[
              { href: "/compass", label: "マイゴール" },
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-2 text-sm text-text2">
            RAG用ドキュメントをアップロードして判定精度を向上させます
          </p>
        </header>

        {/* Upload form */}
        <form
          onSubmit={handleUpload}
          className="mb-8 rounded-lg border border-border-brand bg-surface p-6"
        >
          <label htmlFor="file-upload" className="mb-2 block text-sm font-medium text-text">
            ファイルアップロード
          </label>
          <p id="file-upload-hint" className="mb-3 text-xs text-text2">
            対応形式: Markdown (.md), テキスト (.txt), PDF (.pdf)
          </p>
          <div className="flex gap-2">
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf"
              aria-describedby="file-upload-hint"
              className="flex-1 rounded-lg border border-border-brand px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-root-bg px-4 py-2 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
            >
              {uploading ? "処理中..." : "アップロード"}
            </button>
          </div>
        </form>

        {/* Messages */}
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-bd bg-amber-bg p-3 text-sm text-amber-brand">
            {error}
          </div>
        )}
        {success && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-forest-bd bg-forest-bg p-3 text-sm text-forest">
            {success}
          </div>
        )}

        {/* Document list */}
        <div className="rounded-lg border border-border-brand bg-surface">
          <div className="border-b border-border-brand px-4 py-3">
            <h2 className="text-sm font-medium text-text">
              アップロード済みドキュメント ({documents.length})
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text2">
              ドキュメントがありません
            </div>
          ) : (
            <ul>
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between border-b border-border-brand px-4 py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-text">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-text2">
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
                        className="rounded-lg bg-amber-brand px-2 py-1 text-xs text-root-color hover:opacity-90"
                      >
                        確認
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        aria-label="削除をキャンセル"
                        className="rounded-lg px-2 py-1 text-xs text-text2 hover:bg-bg2"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      aria-label={`${doc.filename}を削除`}
                      className="rounded-lg px-3 py-1.5 text-xs text-amber-brand hover:bg-amber-bg"
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
