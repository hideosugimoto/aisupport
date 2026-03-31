import { ChatDashboard } from "@/components/ChatDashboard";
import { DailySummaryBanner } from "@/components/DailySummaryBanner";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              AI意思決定アシスタント
            </h1>
            <nav className="flex gap-1 flex-wrap">
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
                href="/cost"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                コスト
              </Link>
              <Link
                href="/documents"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                資料
              </Link>
              <Link
                href="/feed"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                フィード
              </Link>
              <Link
                href="/weekly-review"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                振り返り
              </Link>
              <Link
                href="/compass"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                マイゴール
              </Link>
              <Link
                href="/settings"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                設定
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-text2">
            構造と論理で判断。選択肢を削り、完璧より前進。
          </p>
        </header>
        <DailySummaryBanner />
        <ChatDashboard />
      </div>
    </div>
  );
}
