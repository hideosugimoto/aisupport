import { CostDashboard } from "@/components/CostDashboard";
import Link from "next/link";

export default function CostPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              コストダッシュボード
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/compare"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                比較
              </Link>
              <Link
                href="/history"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                履歴
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                タスク決定に戻る
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-text2">
            LLM API利用コストの可視化
          </p>
        </header>
        <CostDashboard />
      </div>
    </div>
  );
}
