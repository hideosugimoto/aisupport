# Plans

> Phase 1 完了タスク (1-24): [docs/plans/archive-phase1.md](docs/plans/archive-phase1.md)

## Phase 2（要件定義書 セクション10）

> **Goal:** 全8機能 + E2E テスト基盤を実装
> **Design:** `docs/plans/2026-02-12-phase2-design.md`

### 1. Claude API (Sonnet) 追加

- [x] 25. Anthropic SDK インストール + ClaudeClient テスト作成 `[feature:tdd]` `cc:done`
  - `npm install @anthropic-ai/sdk` ✅
  - `__tests__/lib/llm/claude-client.test.ts` 新規作成 (10テスト) ✅
  - MockLLMClient パターンで chat/chatStream/extractUsage テスト ✅

- [x] 26. ClaudeClient 実装 `cc:done`
  - `src/lib/llm/claude-client.ts` 本実装 ✅
  - chat(), chatStream(), extractUsage() メソッド ✅
  - Anthropic SDK の messages.create / messages.stream 使用 ✅

- [x] 27. client-factory + config 更新 `cc:done`
  - `src/lib/llm/client-factory.ts` に `claude` ケース追加 ✅
  - `config/features.json` に `"claude"` 追加, `default_model.claude` ✅
  - `.env.local.example` に `ANTHROPIC_API_KEY` 追加 ✅

- [ ] 28. UI にエンジン選択「Claude」追加
  - TaskDecisionForm のプロバイダーボタンに Claude 追加
  - ビルド確認

### 2. 履歴保存・検索

- [x] 29. TaskDecision テーブル追加 (Prisma migration) `cc:done`
  - `prisma/schema.prisma` に TaskDecision モデル追加 ✅
  - `npx prisma migrate dev` 実行 ✅
  - Migration: 20260212054217_add_task_decisions

- [x] 30. TaskDecisionRepository テスト＆実装 `[feature:tdd]` `cc:done`
  - `src/lib/db/types.ts` に TaskDecisionRepository interface 追加 ✅
  - `src/lib/db/prisma-task-decision-repository.ts` 新規作成 ✅
  - save, findAll, findByDateRange, search メソッド ✅
  - `__tests__/lib/db/task-decision-repository.test.ts` テスト (10/10 PASS) ✅

- [ ] 31. /api/history ルート実装 `[feature:security]`
  - `POST /api/history` — 判定結果保存
  - `GET /api/history` — 検索 + ページネーション
  - バリデーション + エラーハンドリング

- [ ] 32. 履歴画面 UI 作成
  - `src/app/history/page.tsx` 新規作成
  - `src/components/HistoryList.tsx` 一覧コンポーネント
  - キーワード検索、展開表示、「再利用」ボタン

- [ ] 33. TaskDecisionForm に自動保存追加
  - completed 時にバックグラウンドで POST /api/history
  - ナビゲーションに履歴リンク追加

### 3. 予算アラート

- [x] 34. BudgetChecker テスト＆実装 `[feature:tdd]` `cc:done`
  - `src/lib/budget/checker.ts` 新規作成 ✅
  - checkBudget(year, month) → alertLevel 判定 ✅
  - `__tests__/lib/budget/checker.test.ts` テスト (7テスト) ✅
  - `config/features.json` に `monthly_budget_usd: 5.0` 追加 ✅

- [ ] 35. /api/cost 拡張 + CostDashboard 予算表示
  - GET /api/cost レスポンスに budget フィールド追加
  - CostDashboard に予算プログレスバー + 警告バナー

- [ ] 36. タスク判定時の予算超過確認
  - TaskDecisionForm で exceeded 時に確認ダイアログ表示

### 4. エンジン間自動フォールバック

- [x] 37. FallbackLLMClient テスト＆実装 `[feature:tdd]` `cc:done`
  - `src/lib/llm/fallback-client.ts` 新規作成 ✅
  - FallbackLLMClient implements LLMClient ✅
  - RATE_LIMITED / SERVER_ERROR でフォールバック ✅
  - `__tests__/lib/llm/fallback-client.test.ts` テスト (11テスト) ✅

- [ ] 38. client-factory フォールバック統合 + UI トグル
  - auto_fallback: true 時に FallbackLLMClient でラップ
  - `config/features.json` に `auto_fallback: false` 追加
  - TaskDecisionForm にフォールバック ON/OFF トグル

### 5. 並列AI比較

- [ ] 39. ParallelDecisionEngine テスト＆実装 `[feature:tdd]`
  - `src/lib/compare/parallel-engine.ts` 新規作成
  - Promise.allSettled() で全有効エンジン同時呼び出し
  - `__tests__/lib/compare/parallel-engine.test.ts` テスト

- [ ] 40. /api/compare ルート + 比較画面 UI
  - `POST /api/compare` — SSE で到着順に送信
  - `src/app/compare/page.tsx` + `src/components/CompareResult.tsx`
  - カード横並び、所要時間・コスト表示、「採用」ボタン

### 6. 週次戦略レビュー

- [ ] 41. 週次レビュープロンプト + WeeklyReviewEngine `[feature:tdd]`
  - `prompts/weekly-review/system.md`, `user-template.md` 新規作成
  - `src/lib/strategy/weekly-review.ts` 新規作成
  - 直近7日の判定履歴を集約 → LLM で振り返り生成
  - `__tests__/lib/strategy/weekly-review.test.ts` テスト

- [ ] 42. /api/weekly-review + CostDashboard レビューセクション
  - `POST /api/weekly-review` — SSE ストリーミング
  - `/cost` ページに「今週のレビュー」展開セクション追加

### 7. プロンプト A/B テスト

- [ ] 43. prompt-builder バージョン対応 `[feature:tdd]`
  - loadTemplate() にバージョン指定パラメータ追加
  - `prompts/task-decision/v2/` サンプルプロンプト作成
  - `config/features.json` に `prompt_ab_test` 設定追加
  - metadata に prompt_version 記録
  - `__tests__/lib/llm/prompt-builder-ab.test.ts` テスト

- [ ] 44. CostDashboard バージョン別フィルタ
  - プロンプトバージョン別のコスト・トークン比較表示

### 8. E2E テスト (Playwright)

- [ ] 45. Playwright セットアップ
  - `npm install -D @playwright/test`
  - `playwright.config.ts` 作成（Next.js dev server 自動起動）
  - `E2E_MOCK=true` 環境変数対応を client-factory に追加

- [ ] 46. E2E: タスク判定フロー
  - `e2e/task-flow.spec.ts` 新規作成
  - タスク入力 → エンジン選択 → 送信 → 結果表示 → 分解ボタン

- [ ] 47. E2E: コスト + 履歴 + 比較
  - `e2e/cost.spec.ts` — ダッシュボード表示 + 予算アラート
  - `e2e/history.spec.ts` — 一覧・検索・展開
  - `e2e/compare.spec.ts` — 並列比較フロー

### 9. 全体検証

- [ ] 48. 全体テスト＆ビルド確認
  - `npx vitest run` 全テスト PASS
  - `npx tsc --noEmit` 型エラー 0
  - `npx next build` ビルド成功
  - `npx playwright test` E2E PASS
