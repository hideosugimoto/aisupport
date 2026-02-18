"use client";

import Link from "next/link";

interface CompassSummaryProps {
  items: { id: number; title: string }[];
  className?: string;
}

export function CompassSummary({ items, className }: CompassSummaryProps) {
  if (items.length === 0) {
    return null;
  }

  const titlesText = items.map((item) => item.title).join(" / ");

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800 ${className ?? ""}`}
    >
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        <span aria-hidden="true">🧭</span> {titlesText}
      </p>
      <Link
        href="/compass"
        className="mt-1 inline-block text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        編集
      </Link>
    </div>
  );
}
