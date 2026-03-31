import { requireAuth } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import Link from "next/link";
import { FeedClient } from "./FeedClient";

export default async function FeedPage() {
  const userId = await requireAuth();
  const plan = await getUserPlan(userId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                ← ダッシュボード
              </Link>
            </div>
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            パーソナルフィード
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            マイゴールをもとにパーソナライズされたニュースをお届けします
          </p>
        </header>

        {!plan.feedEnabled ? (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              パーソナルフィードはProプランで利用できます
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              プランを見る
            </Link>
          </div>
        ) : (
          <FeedClient />
        )}
      </div>
    </div>
  );
}
