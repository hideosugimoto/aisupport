# Plans

## ✅ 完了したタスク

- [x] DecisionResult.tsx の XSS脆弱性を修正 `cc:DONE`
  - 依頼内容: dangerouslySetInnerHTML を削除し、React要素による安全なマークダウンレンダリングに書き換え
  - 追加日時: 2026-02-12
  - 完了日時: 2026-02-12
  - 変更内容:
    - `dangerouslySetInnerHTML` を削除
    - `formatMarkdown` 関数を削除
    - `MarkdownContent` コンポーネントを追加（React要素として安全にレンダリング）
    - `formatInlineMarkdown` 関数を追加（インライン要素の処理）
    - ビルド成功確認済み

## 🟡 未着手のタスク

### タスク分解機能（要件定義書 3.2） `[feature:tdd]`

> **Goal:** タスク決定結果から選ばれたタスクを具体的なサブタスクに分解する機能
> **Design:** `docs/plans/2026-02-12-task-breakdown.md`
> **Architecture:** TaskDecisionEngine と同パターンで TaskBreakdownEngine を実装。SSE ストリーミング対応。DecisionResult にボタン追加、同一画面内インライン表示。

- [x] 1. タスク分解プロンプトテンプレート作成 `cc:DONE`
  - `prompts/task-breakdown/system.md` を本実装に置き換え
  - `prompts/task-breakdown/user-template.md` 新規作成
  - `prompts/task-breakdown/anxiety-mode.md` 新規作成（5〜10分粒度）
  - 完了日時: 2026-02-12

- [x] 2. buildTaskBreakdownMessages テスト作成 `cc:DONE` `[feature:tdd]`
  - `__tests__/lib/llm/prompt-builder-breakdown.test.ts` 新規作成
  - system/user メッセージ構築、anxiety mode ON/OFF の 5 テスト
  - 完了日時: 2026-02-12
  - テスト: PASS (5/5)

- [x] 3. buildTaskBreakdownMessages 実装 `cc:DONE`
  - `src/lib/llm/prompt-builder.ts` に TaskBreakdownInput 型 + buildTaskBreakdownMessages 追加
  - テスト GREEN 確認
  - 完了日時: 2026-02-12

- [x] 4. TaskBreakdownEngine テスト作成 `cc:DONE` `[feature:tdd]`
  - `__tests__/lib/decision/task-breakdown-engine.test.ts` 新規作成
  - LLM呼び出し、usage log 記録、カスタムモデルの 3 テスト
  - 完了日時: 2026-02-12
  - テスト: PASS (3/3)

- [x] 5. TaskBreakdownEngine 実装 `cc:DONE`
  - `src/lib/decision/task-breakdown-engine.ts` 新規作成
  - breakdown() + breakdownStream() メソッド（try/finally パターン）
  - テスト GREEN 確認
  - 完了日時: 2026-02-12
  - 全テスト: PASS (57/57)

- [x] 6. タスク分解バリデーション テスト＆実装 `cc:DONE` `[feature:tdd]`
  - `__tests__/lib/validation/task-breakdown-input.test.ts` 新規作成（6テスト）
  - `src/lib/validation/task-breakdown-input.ts` 新規作成
  - 完了日時: 2026-02-12
  - テスト: PASS (6/6)
  - TypeScript: 型エラー 0件

- [x] 7. /api/breakdown ルート実装 `cc:DONE` `[feature:security]`
  - `src/app/api/breakdown/route.ts` スタブ → 本実装
  - バリデーション → LLM呼び出し → SSE ストリーミング → エラーハンドリング
  - エラーメッセージはサニタイズ済みの日本語メッセージ
  - 完了日時: 2026-02-12
  - TypeScript: 型エラー 0件

- [x] 8. BreakdownResult コンポーネント作成 `cc:DONE`
  - `src/components/BreakdownResult.tsx` 新規作成
  - anxiety mode 表示、MarkdownContent でレンダリング
  - 完了日時: 2026-02-12
  - TypeScript: 型エラー 0件

- [x] 9. MarkdownContent 共有化 + DecisionResult にボタン追加 `cc:DONE`
  - `src/components/MarkdownContent.tsx` を DecisionResult.tsx から抽出
  - DecisionResult に `onBreakdown` コールバック prop 追加
  - 「このタスクを分解する」ボタン表示
  - 完了日時: 2026-02-12
  - TypeScript: 型エラー 0件

- [x] 10. TaskDecisionForm にタスク分解状態管理追加 `cc:DONE`
  - useReducer に breakdown 状態 (breakdownStatus, breakdownContent 等) 追加
  - handleBreakdown 関数追加（/api/breakdown SSE ストリーミング）
  - DecisionResult に onBreakdown={handleBreakdown} を渡す
  - BreakdownResult をインライン表示
  - 完了日時: 2026-02-12
  - TypeScript: 型エラー 0件

- [x] 11. 全体テスト＆ビルド確認 `cc:DONE`
  - `npx vitest run` 全テスト PASS (57/57)
  - `npx tsc --noEmit` 型エラー 0
  - `npx next build` ビルド成功
  - 完了日時: 2026-02-12

### レビュー指摘対応（Security/Quality/Performance/a11y）

- [x] 12. Rate Limiting 実装 `cc:DONE` `[feature:security]`
  - `src/middleware.ts` 新規作成
  - IP ベースのインメモリ rate limiter（外部依存なし）
  - `/api/*` に 1分10リクエスト制限、429 レスポンス
  - 完了日時: 2026-02-12

- [x] 13. CSP/CORS ヘッダー設定 `cc:DONE` `[feature:security]`
  - `next.config.ts` に `headers()` 追加
  - X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
  - 完了日時: 2026-02-12

- [x] 14. Prompt Injection 対策 `cc:DONE` `[feature:security]`
  - `src/lib/llm/prompt-builder.ts` に `sanitizePromptInput()` 追加
  - コードブロック・特殊トークン除去
  - buildTaskDecisionMessages, buildTaskBreakdownMessages の入力に適用
  - 完了日時: 2026-02-12

- [x] 15. formatError 共通化 `cc:DONE`
  - `src/lib/api/format-error.ts` 新規作成済み（既存）
  - decide/route.ts と breakdown/route.ts から共通関数を import済み
  - 完了日時: 2026-02-12

- [x] 16. breakdownStream テスト追加 `cc:DONE` `[feature:tdd]`
  - `__tests__/lib/decision/task-breakdown-engine.test.ts` にストリーミングテスト3件追加
  - 正常系、usage 記録、エラー時のfinally確認
  - 完了日時: 2026-02-12
  - テスト: PASS (6/6)

- [x] 17. featuresConfig 型安全性 `cc:DONE`
  - `src/lib/config/types.ts` 新規作成（FeaturesConfig, ProviderKey, getDefaultModel）
  - decide/breakdown route + engine 4ファイルから型アサーション除去
  - 完了日時: 2026-02-12

- [x] 18. テンプレートプリロード `cc:DONE`
  - `src/lib/llm/prompt-builder.ts` に `preloadTemplates()` 追加
  - 全7テンプレートを起動時にキャッシュ可能
  - 完了日時: 2026-02-12

- [x] 19. aria-live + aria-busy 追加 `cc:DONE` `[feature:a11y]`
  - TaskDecisionForm: 結果表示エリアに `aria-live="polite"` 追加
  - ローディング表示に `role="status"` + `aria-busy="true"` 追加
  - エラー表示に `role="alert"` 追加
  - 送信ボタンに `aria-busy` 追加
  - 完了日時: 2026-02-12

- [x] 20. MarkdownContent 見出しレベル対応 `cc:DONE` `[feature:a11y]`
  - MarkdownContent に `headingOffset` prop 追加（デフォルト 0）
  - h2 → h2+offset, h3 → h3+offset として適切なレベルに調整
  - 完了日時: 2026-02-12

- [x] 21. 全体テスト＆ビルド確認 `cc:DONE`
  - `npx vitest run` 全テスト PASS (60/60)
  - `npx tsc --noEmit` 型エラー 0
  - `npx next build` ビルド成功
  - 完了日時: 2026-02-12

### Security Critical 対応

- [x] 22. Rate Limiter IP スプーフィング対策 `cc:DONE` `[feature:security]`
  - `x-forwarded-for` 直接信頼を廃止（最後のエントリを使用）
  - `setInterval` を削除し、リクエスト時の遅延クリーンアップに変更
  - Map サイズ上限 10000 でメモリリーク防止
  - 完了日時: 2026-02-12

- [x] 23. CSP unsafe-inline/unsafe-eval 除去 `cc:DONE` `[feature:security]`
  - `unsafe-eval` を削除（本番不要）
  - 環境別 CSP 設定（dev: 緩い / prod: 厳格）
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` 追加
  - 完了日時: 2026-02-12

- [x] 24. 全体テスト＆ビルド確認 `cc:DONE`
  - `npx vitest run` 全テスト PASS (60/60)
  - `npx tsc --noEmit` 型エラー 0
  - `npx next build` ビルド成功
  - 完了日時: 2026-02-12
