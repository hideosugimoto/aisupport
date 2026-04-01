"use client";

import Link from "next/link";

interface SubNavLink {
  href: string;
  label: string;
}

const linkMeta: Record<string, { label: string; shape: string; colorClass: string; bgClass: string; bdClass: string }> = {
  "/dashboard": { label: "ホーム", shape: "◆", colorClass: "text-forest", bgClass: "bg-forest-bg", bdClass: "border-forest-bd" },
  "/compare": { label: "比較", shape: "◆", colorClass: "text-forest", bgClass: "bg-forest-bg", bdClass: "border-forest-bd" },
  "/compass": { label: "マイゴール", shape: "▲", colorClass: "text-amber-brand", bgClass: "bg-amber-bg", bdClass: "border-amber-bd" },
  "/history": { label: "履歴", shape: "●", colorClass: "text-sky", bgClass: "bg-sky-bg", bdClass: "border-sky-bd" },
  "/weekly-review": { label: "振り返り", shape: "■", colorClass: "text-moss", bgClass: "bg-moss-bg", bdClass: "border-moss-bd" },
  "/documents": { label: "資料", shape: "◇", colorClass: "text-stone", bgClass: "bg-stone-bg", bdClass: "border-stone-bd" },
  "/feed": { label: "フィード", shape: "◆", colorClass: "text-forest", bgClass: "bg-forest-bg", bdClass: "border-forest-bd" },
  "/cost": { label: "コスト", shape: "▲", colorClass: "text-amber-brand", bgClass: "bg-amber-bg", bdClass: "border-amber-bd" },
  "/settings": { label: "設定", shape: "●", colorClass: "text-sky", bgClass: "bg-sky-bg", bdClass: "border-sky-bd" },
};

interface SubNavProps {
  links: SubNavLink[];
}

export function SubNav({ links }: SubNavProps) {
  return (
    <nav className="flex gap-2 flex-wrap">
      {links.map((link) => {
        const meta = linkMeta[link.href];
        if (!meta) {
          return (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-border-brand bg-bg2 px-3 py-1.5 text-xs text-text2 hover:text-text transition-colors"
            >
              {link.label}
            </Link>
          );
        }
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg border ${meta.bdClass} ${meta.bgClass} px-3 py-1.5 text-xs transition-all hover:shadow-sm hover:-translate-y-px`}
          >
            <span className={`font-bold ${meta.colorClass} mr-1`}>{meta.shape}</span>
            <span className="text-text">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
