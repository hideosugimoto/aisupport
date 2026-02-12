# CLAUDE.md

## プロジェクト概要
AI意思決定アシスタント MVP。詳細は AI_decision_assistant_spec_v6.md を参照。

## 技術スタック
- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Vitest
- OpenAI SDK (gpt-4o-mini) + Google AI SDK (gemini-2.0-flash)

## 設計原則
- 全てインターフェース経由で依存（依存性逆転）
- ビジネスロジックは src/lib/ に集約（Next.js非依存）
- API Routeは薄いコントローラー
- マジックナンバーは config/features.json に集約
- プロンプトは prompts/ に外部ファイル管理（ハードコード禁止）

## テスト方針
- Vitest使用
- LLMClient はモック注入でテスト
- バリデーション・コスト計算は純粋関数テスト

## 参照ドキュメント
- 要件定義書: AI_decision_assistant_spec_v6.md
- 型定義: src/lib/llm/types.ts
- エラー型: src/lib/llm/errors.ts
