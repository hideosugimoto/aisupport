# CLAUDE.md

## プロジェクト概要
AI意思決定アシスタント MVP。詳細は AI_decision_assistant_spec_v6.md を参照。

## コア機能
- **Compass（羅針盤）** — 目標・夢・価値観を登録し、全ての意思決定の判断基準として機能する中核機能
- **Decide（タスク判定）** — Compass + RAG を参照し、今日の最適タスクを決定
- **Compare（比較）** — 複数LLMエンジンで同時判定し、Compass を共通基準として比較

## 技術スタック
- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL (Supabase)
- Vitest
- OpenAI SDK (gpt-4o-mini) + Google AI SDK (gemini-2.0-flash) + Anthropic SDK (Claude)
- Embedding: OpenAI text-embedding-3-small（Compass・RAG 共通、OPENAI_API_KEY 必須）

## 設計原則
- 全てインターフェース経由で依存（依存性逆転）
- ビジネスロジックは src/lib/ に集約（Next.js非依存）
- API Routeは薄いコントローラー
- マジックナンバーは config/features.json に集約
- プロンプトは prompts/ に外部ファイル管理（ハードコード禁止）
- Compass は判断の中心。Decide / Compare / Weekly Review すべてが参照する

## Embedding の API キー解決
- LLM 本体: `resolveApiKey(userId, provider)` で BYOK 対応
- Embedding: `process.env.OPENAI_API_KEY` を使用（OpenAI embedding API 固定のため）
- 将来的に embedding も BYOK 対応する場合は `resolveApiKey` ベースに統一する

## テスト方針
- Vitest使用
- LLMClient はモック注入でテスト
- バリデーション・コスト計算は純粋関数テスト

## 参照ドキュメント
- 要件定義書: AI_decision_assistant_spec_v6.md
- 型定義: src/lib/llm/types.ts
- エラー型: src/lib/llm/errors.ts
- Compass 設定: config/compass.json
- 意思決定エンジン: src/lib/decision/task-decision-engine.ts
- 比較エンジン: src/lib/compare/parallel-engine.ts
- 週次レビュー: src/lib/strategy/weekly-review.ts
