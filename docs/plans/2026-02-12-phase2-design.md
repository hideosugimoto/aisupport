# Phase 2 Implementation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Phase 2 全8機能 + E2E テスト基盤を実装し、日常運用可能な完成度にする

**Architecture:** 既存の依存性逆転アーキテクチャを維持しつつ、Claude API・履歴・予算・フォールバック・並列比較・週次レビュー・A/Bテスト・E2Eテストを追加

**Tech Stack:** Next.js (App Router) + TypeScript + Prisma + SQLite + Vitest + Playwright + Anthropic SDK

---

## 1. Claude API (Sonnet) 追加

### 変更ファイル
- `src/lib/llm/claude-client.ts` — スタブ → 本実装（Anthropic SDK）
- `src/lib/llm/client-factory.ts` — `claude` ケース追加
- `config/features.json` — `enabled_providers` に `"claude"` 追加, `default_model.claude`
- `config/pricing.json` — Claude Sonnet 単価追加
- `.env.local.example` — `ANTHROPIC_API_KEY` 追加

### 実装詳細
- `@anthropic-ai/sdk` パッケージ使用
- `chat()`: `client.messages.create()` → content[0].text
- `chatStream()`: `client.messages.stream()` → content_block_delta を yield
- `extractUsage()`: response.usage の input_tokens / output_tokens
- Claude 選択時: temperature 0.3（論理的出力）
- UI: エンジン選択に「Claude (高品質)」追加

---

## 2. 履歴保存・検索

### DB (schema.prisma)
```prisma
model TaskDecision {
  id            Int      @id @default(autoincrement())
  tasksInput    String   @map("tasks_input")
  energyLevel   Int      @map("energy_level")
  availableTime Int      @map("available_time")
  provider      String
  model         String
  result        String
  createdAt     DateTime @default(now()) @map("created_at")
  @@map("task_decisions")
}
```

### Repository
- `src/lib/db/types.ts` に `TaskDecisionRepository` interface
- `save()`, `findAll(limit, offset)`, `findByDateRange(from, to)`, `search(keyword)`
- `src/lib/db/prisma-task-decision-repository.ts` — 具象実装

### API
- `POST /api/history` — 判定結果保存
- `GET /api/history?q=keyword&from=date&to=date&page=1` — 検索 + ページネーション

### UI (`/history`)
- 日付降順一覧、キーワード検索バー
- 展開して結果全文表示、「再利用」ボタン
- 保存は completed 時に自動（バックグラウンド）

---

## 3. 予算アラート

### 設定
- `config/features.json` に `monthly_budget_usd: 5.00` 追加

### 実装
- `src/lib/budget/checker.ts` — `BudgetChecker`
  - `checkBudget(year, month)`: 当月コスト vs 予算
  - 返却: `{ budgetUsd, spentUsd, remainingUsd, percentUsed, alertLevel: "ok"|"warning"|"exceeded" }`
  - 閾値: 80% → warning, 100% → exceeded
- `GET /api/cost` レスポンスに `budget` フィールド追加
- CostDashboard に予算プログレスバー + 警告バナー
- タスク判定時、exceeded なら確認ダイアログ

---

## 4. エンジン間自動フォールバック

### 設定
- `config/features.json` に `auto_fallback: false` 追加

### 実装
- `src/lib/llm/fallback-client.ts` — `FallbackLLMClient implements LLMClient`
  - `constructor(primary: LLMClient, fallbacks: LLMClient[])`
  - RATE_LIMITED / SERVER_ERROR でのみフォールバック
  - フォールバック発生時に metadata に記録
- `src/lib/llm/client-factory.ts` — `auto_fallback: true` 時に FallbackLLMClient でラップ
- UI: TaskDecisionForm にフォールバック ON/OFF トグル
- フォールバック順: pricing 安い順

---

## 5. 並列AI比較

### 実装
- `src/lib/compare/parallel-engine.ts` — `ParallelDecisionEngine`
  - `Promise.allSettled()` で全有効エンジンを同時呼び出し
  - 結果: `{ provider, model, content, usage, latencyMs, error? }[]`
- `POST /api/compare` — SSE で到着順に送信
- `/compare` 画面:
  - カード形式で横並び表示（OpenAI | Gemini | Claude）
  - 所要時間・トークン数・推定コスト表示
  - 「この結果を採用」ボタン → 履歴保存

---

## 6. 週次戦略レビュー

### 実装
- `src/lib/strategy/weekly-review.ts` — `WeeklyReviewEngine`
  - 直近7日の判定履歴を集約
  - LLM に「今週の振り返り + 来週の提案」生成
- `prompts/weekly-review/system.md`, `user-template.md` 新規
- `POST /api/weekly-review` — SSE ストリーミング
- `/cost` ページに「今週のレビュー」セクション（展開式）

---

## 7. プロンプト A/B テスト

### 実装
- `prompts/task-decision/v2/` に新バージョン配置
- `config/features.json` に `prompt_ab_test: { enabled: false, variant: "v1" }` 追加
- `prompt-builder.ts` の `loadTemplate()` をバージョン対応に拡張
- `llm_usage_logs.metadata` に `{ prompt_version: "v2" }` 記録
- CostDashboard でバージョン別フィルタ表示

---

## 8. E2E テスト (Playwright)

### セットアップ
- `playwright.config.ts` — Next.js dev server 自動起動
- `E2E_MOCK=true` 環境変数で MockLLMClient 使用

### テストケース
```
e2e/
├── fixtures/            # 共通セットアップ
├── task-flow.spec.ts    # タスク入力→判定→分解
├── cost.spec.ts         # コストダッシュボード + 予算アラート
├── history.spec.ts      # 履歴一覧・検索
└── compare.spec.ts      # 並列比較フロー
```
