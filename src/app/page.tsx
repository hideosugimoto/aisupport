import { TaskDecisionForm } from "@/components/TaskDecisionForm";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              AI意思決定アシスタント
            </h1>
            <div className="flex gap-4">
              <Link
                href="/history"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                履歴
              </Link>
              <Link
                href="/cost"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                コスト確認
              </Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            構造と論理で判断。選択肢を削り、完璧より前進。
          </p>
        </header>
        <TaskDecisionForm />
      </div>
    </div>
  );
}
