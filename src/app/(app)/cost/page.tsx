import { CostDashboard } from "@/components/CostDashboard";
import Link from "next/link";

export default function CostPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              コストダッシュボード
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/compare"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                比較
              </Link>
              <Link
                href="/history"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                履歴
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定に戻る
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            LLM API利用コストの可視化
          </p>
        </header>
        <CostDashboard />
      </div>
    </div>
  );
}
