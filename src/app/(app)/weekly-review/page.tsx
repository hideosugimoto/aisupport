import { requireAuth } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import Link from "next/link";
import { WeeklyReviewClient } from "./WeeklyReviewClient";

export default async function WeeklyReviewPage() {
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
            週次レビュー
          </h1>
          <p className="mt-1 text-sm text-text2">
            過去7日間のタスク判定を振り返ります
          </p>
        </header>

        <WeeklyReviewClient isPro={plan.weeklyReviewEnabled} />
      </div>
    </div>
  );
}
