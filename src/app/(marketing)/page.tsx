import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
        <h1 className="text-3xl sm:text-5xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
          迷いを断ち、前に進む。
        </h1>
        <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
          AI意思決定アシスタントが、あなたのタスクを構造化し、
          論理的に最適な行動を提案します。
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            無料で始める
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ログイン
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-4 py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-12">
          主な機能
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xl">&#x1F9E0;</span>
            </div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              タスク意思決定
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              エネルギーレベルと時間に基づいて、今やるべきタスクをAIが提案
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xl">&#x1F50D;</span>
            </div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              あなたの資料から判断
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              アップロードした資料を読み取り、あなたの状況に合った判断を提案
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xl">&#x1F4CA;</span>
            </div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              AI3つに聞いて比較
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              OpenAI・Gemini・Claudeの3つのAIに同時に聞いて、最適な答えを選べます
            </p>
          </div>
        </div>
      </section>

      {/* Sample Result */}
      <section className="mx-auto max-w-4xl px-4 py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-4">
          こんな風に使います
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8">
          タスクと今の状態を入力するだけ。AIが最適な行動を提案します。
        </p>
        <div className="max-w-2xl mx-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <p>タスク: 企画書作成 / メール返信 / 英語学習</p>
            <p>時間: 1時間 &#x2F; 調子: ふつう</p>
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              AIの判定結果
            </p>
            <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
              <p className="font-medium">
                まず「メール返信」から始めましょう。
              </p>
              <p>
                15分で完了できるタスクを先に片付けることで達成感が生まれ、
                残り45分で「企画書作成」に集中力を持って取り組めます。
                英語学習は夜のリラックスタイムに回すのが効果的です。
              </p>
              <p className="font-medium mt-3">
                最初の5分: メールアプリを開き、返信が必要なメールを3件選ぶ
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-4xl px-4 py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-12">
          料金
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Free</h3>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              &#165;0<span className="text-sm font-normal text-zinc-500">/月</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>月10リクエスト</li>
              <li>タスク意思決定・分解</li>
              <li>マルチモデル比較</li>
              <li>プッシュ通知</li>
            </ul>
            <Link
              href="/sign-up"
              className="mt-6 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              無料で始める
            </Link>
          </div>
          <div className="rounded-lg border-2 border-zinc-900 bg-white p-6 dark:border-zinc-100 dark:bg-zinc-900">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Pro</h3>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              &#165;500<span className="text-sm font-normal text-zinc-500">/月</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              年額 &#165;4,800（月あたり&#165;400・2ヶ月分お得）
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>リクエスト無制限</li>
              <li>あなたの資料から判断</li>
              <li>週次AIレビュー</li>
              <li>自分のAIキーで使い放題</li>
            </ul>
            <Link
              href="/sign-up"
              className="mt-6 block w-full rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Proで始める
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-4xl px-4 py-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <p>AI意思決定アシスタント</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
