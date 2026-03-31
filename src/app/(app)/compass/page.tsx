"use client";

import { useState, useEffect, useCallback } from "react";
import { CompassAddForm } from "@/components/CompassAddForm";
import { CompassItemCard } from "@/components/CompassItemCard";
import Link from "next/link";

interface CompassItem {
  id: number;
  type: string;
  title: string;
  content: string;
  sourceUrl?: string | null;
  imageKey?: string | null;
  createdAt: string;
  chunkCount: number;
}

export default function CompassPage() {
  const [items, setItems] = useState<CompassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/compass");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              マイゴール
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定
              </Link>
              <Link
                href="/documents"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                RAG
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            夢・目標・インスピレーションを登録して、日々のタスク判定の指針にしましょう。
          </p>
        </header>

        <CompassAddForm onItemAdded={fetchItems} />

        <div className="mt-8" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="text-center text-zinc-500">読み込み中...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <p className="text-4xl mb-4" aria-hidden="true">🧭</p>
              <p className="font-medium">まだマイゴールが登録されていません。</p>
              <p className="text-sm mt-1">あなたの夢や目標を追加してみましょう。</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <CompassItemCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
