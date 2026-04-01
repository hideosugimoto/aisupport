"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
  description: string;
  shape: string;
  colorClass: string;
  bgClass: string;
  bdClass: string;
  requireByok?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/compare",
    label: "比較",
    description: "複数AIで同時判定",
    shape: "◆",
    colorClass: "text-forest",
    bgClass: "bg-forest-bg",
    bdClass: "border-forest-bd",
  },
  {
    href: "/compass",
    label: "マイゴール",
    description: "目標・価値観を管理",
    shape: "▲",
    colorClass: "text-amber-brand",
    bgClass: "bg-amber-bg",
    bdClass: "border-amber-bd",
  },
  {
    href: "/history",
    label: "履歴",
    description: "過去の判定結果",
    shape: "●",
    colorClass: "text-sky",
    bgClass: "bg-sky-bg",
    bdClass: "border-sky-bd",
  },
  {
    href: "/weekly-review",
    label: "振り返り",
    description: "週次レビュー",
    shape: "■",
    colorClass: "text-moss",
    bgClass: "bg-moss-bg",
    bdClass: "border-moss-bd",
  },
  {
    href: "/documents",
    label: "資料",
    description: "参考ドキュメント",
    shape: "◇",
    colorClass: "text-stone",
    bgClass: "bg-stone-bg",
    bdClass: "border-stone-bd",
  },
  {
    href: "/feed",
    label: "フィード",
    description: "最新の判定トレンド",
    shape: "◆",
    colorClass: "text-forest",
    bgClass: "bg-forest-bg",
    bdClass: "border-forest-bd",
  },
  {
    href: "/cost",
    label: "コスト",
    description: "API使用量の確認",
    shape: "▲",
    colorClass: "text-amber-brand",
    bgClass: "bg-amber-bg",
    bdClass: "border-amber-bd",
    requireByok: true,
  },
  {
    href: "/settings",
    label: "設定",
    description: "アカウント・API設定",
    shape: "●",
    colorClass: "text-sky",
    bgClass: "bg-sky-bg",
    bdClass: "border-sky-bd",
  },
];

export function DashboardNav() {
  const [hasByok, setHasByok] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/billing/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setHasByok(data.hasByok ?? false);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const visibleItems = navItems.filter(
    (item) => !item.requireByok || (loaded && hasByok)
  );

  return (
    <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`group rounded-xl border ${item.bdClass} ${item.bgClass} px-3 py-3 transition-all hover:shadow-md hover:-translate-y-0.5`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${item.colorClass}`}>
              {item.shape}
            </span>
            <span className="text-sm font-semibold text-text group-hover:text-text">
              {item.label}
            </span>
          </div>
          <p className="text-xs text-text2 leading-tight">
            {item.description}
          </p>
        </Link>
      ))}
    </nav>
  );
}
