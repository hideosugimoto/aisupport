"use client";

import { useState, useRef, FormEvent, ChangeEvent } from "react";

type CompassType = "text" | "url" | "image";

interface CompassAddFormProps {
  onItemAdded: () => void;
}

export function CompassAddForm({ onItemAdded }: CompassAddFormProps) {
  const [type, setType] = useState<CompassType>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let response: Response;

      if (type === "image") {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setError("画像を選択してください");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        if (title) formData.append("title", title);
        response = await fetch("/api/compass", { method: "POST", body: formData });
      } else {
        response = await fetch("/api/compass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title: title || undefined, content }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "追加に失敗しました");
        return;
      }

      // Reset form
      setTitle("");
      setContent("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onItemAdded();
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border-brand bg-surface p-6"
    >
      <h2 className="mb-4 text-lg font-semibold text-text">
        新しいマイゴールを追加
      </h2>

      {/* Type tabs */}
      <div className="mb-4 flex gap-2 border-b border-border-brand" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-text"
          aria-selected={type === "text"}
          aria-controls="panel-text"
          onClick={() => setType("text")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            type === "text"
              ? "border-b-2 border-root-bg text-text"
              : "text-text2 hover:text-text"
          }`}
        >
          <span aria-hidden="true">📝</span> テキスト
        </button>
        <button
          type="button"
          role="tab"
          id="tab-url"
          aria-selected={type === "url"}
          aria-controls="panel-url"
          onClick={() => setType("url")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            type === "url"
              ? "border-b-2 border-root-bg text-text"
              : "text-text2 hover:text-text"
          }`}
        >
          <span aria-hidden="true">🔗</span> URL
        </button>
        <button
          type="button"
          role="tab"
          id="tab-image"
          aria-selected={type === "image"}
          aria-controls="panel-image"
          onClick={() => setType("image")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            type === "image"
              ? "border-b-2 border-root-bg text-text"
              : "text-text2 hover:text-text"
          }`}
        >
          <span aria-hidden="true">🖼️</span> 画像
        </button>
      </div>

      {/* Title input (common for all types) */}
      <div className="mb-4">
        <label htmlFor="compass-title" className="mb-2 block text-sm font-medium text-text">
          タイトル {type !== "image" && "(任意)"}
        </label>
        <input
          id="compass-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "text"
              ? "例: 3年後の夢"
              : type === "url"
              ? "例: 憧れのライフスタイル"
              : "例: ビジョンボード"
          }
          className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
        />
      </div>

      {/* Content input based on type */}
      {type === "text" && (
        <div role="tabpanel" id="panel-text" aria-labelledby="tab-text" className="mb-4">
          <label htmlFor="compass-content" className="mb-2 block text-sm font-medium text-text">
            内容 <span className="text-amber-brand">*</span>
          </label>
          <textarea
            id="compass-content"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="あなたの夢や目標、大切にしている価値観を自由に書いてください..."
            className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
          />
        </div>
      )}

      {type === "url" && (
        <div role="tabpanel" id="panel-url" aria-labelledby="tab-url" className="mb-4">
          <label htmlFor="compass-url" className="mb-2 block text-sm font-medium text-text">
            URL <span className="text-amber-brand">*</span>
          </label>
          <input
            id="compass-url"
            type="url"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="https://example.com/inspiring-article"
            className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
          />
          <p className="mt-1 text-xs text-text2">
            記事や画像のURLを入力すると、AIが内容を要約します
          </p>
        </div>
      )}

      {type === "image" && (
        <div role="tabpanel" id="panel-image" aria-labelledby="tab-image" className="mb-4">
          <label htmlFor="compass-image" className="mb-2 block text-sm font-medium text-text">
            画像 <span className="text-amber-brand">*</span>
          </label>
          <input
            id="compass-image"
            ref={fileRef}
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="w-full rounded-lg border border-border-brand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
          />
          <p className="mt-1 text-xs text-text2">
            対応形式: JPEG, PNG, WebP
          </p>
          {preview && (
            <div className="mt-3">
              <img
                src={preview}
                alt="アップロード予定の画像プレビュー"
                className="max-h-48 rounded-lg border border-border-brand"
              />
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-bd bg-amber-bg p-3 text-sm text-amber-brand">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-root-bg px-4 py-2 text-sm font-medium text-root-color transition-colors hover:bg-forest disabled:opacity-50"
      >
        {loading ? "追加中..." : "追加"}
      </button>
    </form>
  );
}
