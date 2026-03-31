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
      className={`rounded-lg border border-border-brand bg-bg p-3 ${className ?? ""}`}
    >
      <p className="text-sm text-text">
        <span aria-hidden="true">🧭</span> {titlesText}
      </p>
      <Link
        href="/compass"
        className="mt-1 inline-block text-xs text-text3 hover:text-text2"
      >
        編集
      </Link>
    </div>
  );
}
