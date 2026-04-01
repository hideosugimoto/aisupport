import { requireAuth } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import Link from "next/link";
import { SubNav } from "@/components/SubNav";
import { FeedClient } from "./FeedClient";

export default async function FeedPage() {
  const userId = await requireAuth();
  const plan = await getUserPlan(userId);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              パーソナルフィード
            </h1>
            <SubNav links={[
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
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
