import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            &larr; トップに戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            プライバシーポリシー
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            最終更新日: 2026年2月14日
          </p>
        </header>

        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">1. 収集する情報</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              本サービスでは以下の情報を収集します：
            </p>
            <ul className="list-disc pl-5 text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>アカウント情報（メールアドレス、認証情報 — Clerk経由）</li>
              <li>タスク入力データ（意思決定リクエストの内容）</li>
              <li>LLM利用ログ（トークン数、プロバイダー、モデル名）</li>
              <li>アップロードされたドキュメント（RAG機能利用時）</li>
              <li>決済情報（Stripe経由で処理、当方はカード情報を保持しません）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">2. 情報の利用目的</h2>
            <ul className="list-disc pl-5 text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>サービスの提供・運営</li>
              <li>利用状況の分析・サービス改善</li>
              <li>課金処理</li>
              <li>ユーザーサポート</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">3. 第三者提供</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              以下のサービスにデータを送信します：
            </p>
            <ul className="list-disc pl-5 text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>OpenAI / Google / Anthropic — タスク処理のためのLLM API</li>
              <li>Clerk — 認証基盤</li>
              <li>Stripe — 決済処理</li>
              <li>Supabase — データベースホスティング</li>
            </ul>
            <p className="text-zinc-600 dark:text-zinc-400">
              上記以外の第三者にユーザーデータを販売・共有することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">4. データの保管</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              データはSupabase（AWS上のPostgreSQL）に保管されます。
              暗号化されたAPIキーはAES-256-GCMで保護されます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">5. データの削除</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              設定ページから「アカウント削除」を実行すると、すべてのユーザーデータが削除されます。
              削除後のデータ復元はできません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">6. Cookie</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              認証セッション管理のためにCookieを使用します（Clerk提供）。
              分析目的のトラッキングCookieは使用しません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7. お問い合わせ</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              プライバシーに関するお問い合わせは、サービス内のサポート機能よりご連絡ください。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
