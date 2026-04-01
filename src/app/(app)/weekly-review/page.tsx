import { requireAuth } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { SubNav } from "@/components/SubNav";
import { WeeklyReviewClient } from "./WeeklyReviewClient";

export default async function WeeklyReviewPage() {
  const userId = await requireAuth();
  const plan = await getUserPlan(userId);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              週次レビュー
            </h1>
            <SubNav links={[
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-1 text-sm text-text2">
            過去7日間のタスク判定を振り返ります
          </p>
        </header>

        <WeeklyReviewClient isPro={plan.weeklyReviewEnabled} />
      </div>
    </div>
  );
}
