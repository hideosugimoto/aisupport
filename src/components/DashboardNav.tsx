"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  const linkClass =
    "rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2";

  return (
    <nav className="flex gap-1 flex-wrap">
      <Link href="/compare" className={linkClass}>
        比較
      </Link>
      <Link href="/history" className={linkClass}>
        履歴
      </Link>
      {loaded && hasByok && (
        <Link href="/cost" className={linkClass}>
          コスト
        </Link>
      )}
      <Link href="/documents" className={linkClass}>
        資料
      </Link>
      <Link href="/feed" className={linkClass}>
        フィード
      </Link>
      <Link href="/weekly-review" className={linkClass}>
        振り返り
      </Link>
      <Link href="/compass" className={linkClass}>
        マイゴール
      </Link>
      <Link href="/settings" className={linkClass}>
        設定
      </Link>
    </nav>
  );
}
