import { ChatDashboard } from "@/components/ChatDashboard";
import { DailySummaryBanner } from "@/components/DailySummaryBanner";
import { DashboardNav } from "@/components/DashboardNav";
import { Onboarding } from "@/components/Onboarding";

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <Onboarding />
        <header className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-text">
            AI意思決定アシスタント
          </h1>
          <p className="mt-1 mb-4 text-sm text-text2">
            構造と論理で判断。選択肢を削り、完璧より前進。
          </p>
          <DashboardNav />
        </header>
        <DailySummaryBanner />
        <ChatDashboard />
      </div>
    </div>
  );
}
