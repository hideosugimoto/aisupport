# Phase 2 完了タスク (25-48)

> **Goal:** 全8機能 + E2E テスト基盤を実装
> **Design:** `docs/plans/2026-02-12-phase2-design.md`

### 1. Claude API (Sonnet) 追加

- [x] 25. Anthropic SDK インストール + ClaudeClient テスト作成 `[feature:tdd]` `cc:done`
- [x] 26. ClaudeClient 実装 `cc:done`
- [x] 27. client-factory + config 更新 `cc:done`
- [x] 28. UI にエンジン選択「Claude」追加 `cc:done`

### 2. 履歴保存・検索

- [x] 29. TaskDecision テーブル追加 (Prisma migration) `cc:done`
- [x] 30. TaskDecisionRepository テスト＆実装 `[feature:tdd]` `cc:done`
- [x] 31. /api/history ルート実装 `[feature:security]` `cc:done`
- [x] 32. 履歴画面 UI 作成 `cc:done`
- [x] 33. TaskDecisionForm に自動保存追加 `cc:done`

### 3. 予算アラート

- [x] 34. BudgetChecker テスト＆実装 `[feature:tdd]` `cc:done`
- [x] 35. /api/cost 拡張 + CostDashboard 予算表示 `cc:done`
- [x] 36. タスク判定時の予算超過確認 `cc:done`

### 4. エンジン間自動フォールバック

- [x] 37. FallbackLLMClient テスト＆実装 `[feature:tdd]` `cc:done`
- [x] 38. client-factory フォールバック統合 + UI トグル `cc:done`

### 5. 並列AI比較

- [x] 39. ParallelDecisionEngine テスト＆実装 `[feature:tdd]` `cc:done`
- [x] 40. /api/compare ルート + 比較画面 UI `cc:done`

### 6. 週次戦略レビュー

- [x] 41. 週次レビュープロンプト + WeeklyReviewEngine `[feature:tdd]` `cc:done`
- [x] 42. /api/weekly-review + CostDashboard レビューセクション `cc:done`

### 7. プロンプト A/B テスト

- [x] 43. prompt-builder バージョン対応 `[feature:tdd]` `cc:done`
- [x] 44. CostDashboard バージョン別フィルタ `cc:done`

### 8. E2E テスト (Playwright)

- [x] 45. Playwright セットアップ `cc:done`
- [x] 46. E2E: タスク判定フロー `cc:done`
- [x] 47. E2E: コスト + 履歴 + 比較 `cc:done`

### 9. 全体検証

- [x] 48. 全体テスト＆ビルド確認 `cc:done`
