import { CostDashboard } from "@/components/CostDashboard";
import { SubNav } from "@/components/SubNav";

export default function CostPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              コストダッシュボード
            </h1>
            <SubNav links={[
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-2 text-sm text-text2">
            API利用コストの確認
          </p>
        </header>
        <CostDashboard />
      </div>
    </div>
  );
}
