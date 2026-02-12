import { CostDashboard } from "@/components/CostDashboard";
import Link from "next/link";

export default function CostPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              コストダッシュボード
            </h1>
            <div className="flex gap-4">
              <Link
                href="/history"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                履歴
              </Link>
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                タスク決定に戻る
              </Link>
            </div>
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
