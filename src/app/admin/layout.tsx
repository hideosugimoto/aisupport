import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              管理画面
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                ユーザー
              </Link>
              <Link
                href="/admin/logs"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                操作ログ
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-text2 hover:text-text hover:bg-bg2"
              >
                アプリへ戻る
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
