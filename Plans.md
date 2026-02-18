# Plans

> Phase 1 完了タスク (1-24): [docs/plans/archive-phase1.md](docs/plans/archive-phase1.md)
> Phase 2 完了タスク (25-48): [docs/plans/archive-phase2.md](docs/plans/archive-phase2.md)
> Phase 3〜5 完了タスク (49-90): [docs/plans/archive-phase3-5.md](docs/plans/archive-phase3-5.md)
> Phase 6〜7 完了タスク (91-106): [docs/plans/archive-phase6-7.md](docs/plans/archive-phase6-7.md)

---

## Phase 8（Logger 基盤 — クリーンアーキテクチャ対応ログ）

> **Goal:** ビジネスロジックが console に依存しない Logger インターフェース + DI パターンを導入。デバッグ効率化と可観測性向上
> **Design:** `docs/plans/2026-02-18-logger-design.md`

### 優先度マトリクス

| 分類 | タスク |
|------|--------|
| **Required** | 107, 108, 109, 110 |
| **Recommended** | 111 |

### タスク一覧

- [x] 107. Logger インターフェース・実装・ファクトリ作成 `cc:done`
  - `Logger` インターフェース定義（debug/info/warn/error/child）
  - `ConsoleLogger` 実装（レベルフィルタ + タグ付き出力）
  - `createLogger(name)` ファクトリ（LOG_LEVEL 環境変数で制御）
  - ファイル: `src/lib/logger/types.ts`, `src/lib/logger/console-logger.ts`, `src/lib/logger/index.ts`
  - テスト: `__tests__/lib/logger/console-logger.test.ts`
    - レベルフィルタ: debug レベルのログが info モードで出力されないこと
    - child(): 名前が `parent:child` 形式になること
    - 各レベルのメソッドが正しい console メソッドを呼ぶこと

- [x] 108. CompassSuggester / NeglectDetector に Logger DI 適用 `cc:done`
  - コンストラクタに `Logger` パラメータ追加
  - 既存の `console.log/warn/error` を `this.logger.info/warn/error` に置換
  - 各分岐点に適切なログ追加（null返却理由、検出結果、LLM応答状況）
  - ファイル: `src/lib/compass/compass-suggester.ts`, `src/lib/compass/neglect-detector.ts`
  - テスト更新: `__tests__/compass/compass-suggester.test.ts`, `__tests__/compass/neglect-detector.test.ts`
    - Logger モックを注入、既存テストが引き続き PASS すること

- [x] 109. POST /api/compass/suggest に Logger 生成・注入 `cc:done`
  - `createLogger("api:compass-suggest")` で Logger 生成
  - `logger.child("suggester")` で CompassSuggester に渡す
  - リクエスト受信・レスポンス返却・エラー時のログ追加
  - ファイル: `src/app/api/compass/suggest/route.ts`

- [x] 110. ビルド + テスト検証 `cc:done`
  - `npx vitest run` — 全テスト PASS
  - `npx next build` — ビルド成功
  - Vercel デプロイ後に LOG_LEVEL=debug で動作確認

- [x] 111. 主要 API への Logger 展開（Phase 2） `cc:done`
  - TaskDecisionEngine に Logger DI 追加
  - POST /api/decide, /api/breakdown に Logger 注入
  - key-resolver 等のユーティリティにも適用
  - 既存の console.warn を Logger に置換
