import Link from "next/link";

export default function TermsPage() {
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
            利用規約
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            最終更新日: 2026年2月14日
          </p>
        </header>

        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第1条（適用）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              本利用規約（以下「本規約」）は、AI意思決定アシスタント（以下「本サービス」）の利用条件を定めるものです。
              ユーザーは本規約に同意の上、本サービスをご利用ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第2条（サービス内容）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              本サービスは、AIを活用したタスク意思決定支援を提供します。
              AIの回答は参考情報であり、最終的な判断はユーザー自身の責任で行ってください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第3条（アカウント）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              ユーザーは正確な情報を登録し、アカウントを適切に管理する責任を負います。
              アカウントの不正利用により生じた損害について、当方は責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第4条（料金・決済）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              有料プランの料金はサービス内に表示される金額に従います。
              決済はStripeを通じて行われ、Stripeの利用規約も適用されます。
              解約はいつでも可能で、現在の請求期間終了まで利用できます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第5条（禁止事項）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              以下の行為を禁止します：不正アクセス、サービスの逆コンパイル、
              他のユーザーへの妨害行為、APIの過度な利用。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第6条（免責事項）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              本サービスは「現状有姿」で提供されます。
              AIの回答の正確性、完全性、有用性について保証しません。
              本サービスの利用により生じた損害について、法令上許容される範囲で責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">第7条（規約の変更）</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              当方は必要に応じて本規約を変更できます。
              重要な変更はサービス内で通知します。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
