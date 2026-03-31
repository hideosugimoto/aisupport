import { requireAuth } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import Link from "next/link";
import { FeedClient } from "./FeedClient";

export default async function FeedPage() {
  const userId = await requireAuth();
  const plan = await getUserPlan(userId);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm text-text2 hover:text-text"
              >
                ← ダッシュボード
              </Link>
            </div>
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold text-text">
            パーソナルフィード
          </h1>
          <p className="mt-1 text-sm text-text2">
            マイゴールをもとにパーソナライズされたニュースをお届けします
          </p>
        </header>

        {!plan.feedEnabled ? (
          <div className="rounded-lg border border-border-brand p-8 text-center">
            <p className="text-text2 mb-4">
              パーソナルフィードはProプランで利用できます
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm bg-root-bg text-root-color font-medium hover:bg-forest transition-colors"
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
