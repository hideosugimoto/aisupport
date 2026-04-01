"use client";

import { useState, useEffect, useCallback } from "react";
import { CompassAddForm } from "@/components/CompassAddForm";
import { CompassItemCard } from "@/components/CompassItemCard";
import { SubNav } from "@/components/SubNav";

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
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              マイゴール
            </h1>
            <SubNav links={[
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-2 text-sm text-text2">
            夢・目標・インスピレーションを登録して、日々のタスク判定の指針にしましょう。
          </p>
        </header>

        <CompassAddForm onItemAdded={fetchItems} />

        <div className="mt-8" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="text-center text-sm text-text2 py-12">読み込み中...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border-brand bg-surface p-8 text-center">
              <p className="font-medium text-text2">まだマイゴールが登録されていません。</p>
              <p className="text-sm mt-1 text-text3">あなたの夢や目標を追加してみましょう。</p>
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
