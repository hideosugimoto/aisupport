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

---

## Phase 9（パーソナルフィード — 羅針盤ベースのニュース自動収集）

> **Goal:** 羅針盤データからLLMでキーワード自動生成し、Google News RSSでパーソナライズされたニュース・記事を収集・表示する
> **Design:** `docs/plans/2026-02-19-personal-feed-design.md`

### 優先度マトリクス

| 分類 | タスク |
|------|--------|
| **Required** | 112, 113, 114, 115, 116, 117 |
| **Recommended** | 118, 119 |

### タスク一覧

- [ ] 112. DBスキーマ + Config + プラン制限追加
  - Prisma に `FeedKeyword`, `FeedArticle` モデル追加
  - `config/feed.json` 作成（キーワード上限、記事保持日数、1回の取得上限）
  - `config/plans.json` に `feed_enabled` フラグ追加（free: false, pro: true）
  - `src/lib/billing/plan-gate.ts` の `PlanInfo` に `feedEnabled` 追加
  - `prisma generate` + マイグレーション実行
  - ファイル:
    - 修正: `prisma/schema.prisma`
    - 作成: `config/feed.json`
    - 修正: `config/plans.json`
    - 修正: `src/lib/billing/plan-gate.ts`
  - テスト: 既存の plan-gate テストが PASS すること

- [ ] 113. 型定義 + キーワードジェネレーター（TDD）
  - `src/lib/feed/types.ts` — FeedKeyword, FeedArticle, FeedConfig 型定義
  - `src/lib/feed/keyword-generator.ts` — 羅針盤テキスト → LLM → キーワード配列
  - `prompts/feed/generate-keywords.md` — キーワード生成プロンプト
  - DI: `LLMClient`, `Logger` をコンストラクタ注入
  - `loadTemplate("feed", "generate-keywords.md")` でプロンプト読込
  - LLM応答のJSONパース + バリデーション（配列、各要素が文字列、最大10個）
  - ファイル:
    - 作成: `src/lib/feed/types.ts`
    - 作成: `src/lib/feed/keyword-generator.ts`
    - 作成: `prompts/feed/generate-keywords.md`
  - テスト: `__tests__/feed/keyword-generator.test.ts`
    - 羅針盤アイテムからキーワード配列を正しく返すこと
    - LLM応答が不正JSON時に空配列を返すこと
    - 羅針盤アイテムが0件の場合に空配列を返すこと
    - キーワードが10個を超える場合に10個に切り詰めること

- [ ] 114. ニュースフェッチャー（TDD）
  - `fast-xml-parser` パッケージ追加（`npm install fast-xml-parser`）
  - `src/lib/feed/news-fetcher.ts` — キーワード → Google News RSS fetch → パース → 記事配列
  - Google News RSS URL: `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`
  - AbortController + タイムアウト（`config/feed.json` の `fetch_timeout_ms`）
  - RSS XML → `{ title, url, snippet, publishedAt }` 配列に変換
  - ファイル:
    - 作成: `src/lib/feed/news-fetcher.ts`
  - テスト: `__tests__/feed/news-fetcher.test.ts`
    - 正常なRSS XMLから記事配列を返すこと
    - 空のRSSから空配列を返すこと
    - fetchエラー時に空配列を返すこと（例外を投げない）
    - タイムアウト設定が適用されること

- [ ] 115. API Routes — キーワード管理 + フィード取得
  - `GET /api/feed` — 記事一覧取得（query: category, page）、Pro判定
  - `POST /api/feed/refresh` — 手動リフレッシュ（キーワード取得 → RSS fetch → DB保存）
  - `POST /api/feed/keywords/generate` — 羅針盤からキーワード再生成
  - `GET /api/feed/keywords` — 現在のキーワード一覧
  - `PATCH /api/feed/[id]` — 既読フラグ更新
  - 全ルートに `requireAuth()` + `getUserPlan()` で Pro 判定
  - Logger: `createLogger("api:feed")`
  - ファイル:
    - 作成: `src/app/api/feed/route.ts`
    - 作成: `src/app/api/feed/refresh/route.ts`
    - 作成: `src/app/api/feed/keywords/route.ts`
    - 作成: `src/app/api/feed/keywords/generate/route.ts`
    - 作成: `src/app/api/feed/[id]/route.ts`

- [ ] 116. フィードページ UI
  - `/feed` ページ（サーバーコンポーネント: プラン判定、初期データ取得）
  - タブ切替: 「ニュース」/「ブログ・コラム」（クライアントコンポーネント）
  - 記事カード: タイトル、ソース、日時、概要、キーワードタグ
  - 手動リフレッシュボタン（ローディング状態）
  - キーワードチップ表示
  - 空状態: キーワード未生成時の案内 + 「キーワードを生成する」ボタン
  - Freeユーザー: 「Proで使える」アップグレード案内
  - 「もっと読む」ページネーション
  - ダッシュボードのナビに「フィード」リンク追加
  - ファイル:
    - 作成: `src/app/(app)/feed/page.tsx`
    - 修正: `src/app/(app)/dashboard/page.tsx` — nav に `/feed` リンク追加

- [ ] 117. ビルド + テスト検証
  - `npx vitest run` — 全テスト PASS
  - `npx next build` — ビルド成功
  - 手動動作確認: キーワード生成 → 記事取得 → 表示

- [ ] 118. Cron バッチ処理
  - `POST /api/feed/cron` — CRON_SECRET 認証、全Proユーザーの記事を一括取得
  - 30日超の古い記事を自動削除
  - `vercel.json` に cron 設定追加（1日1回）
  - ファイル:
    - 作成: `src/app/api/feed/cron/route.ts`
    - 修正: `vercel.json`

- [ ] 119. E2E動作確認 + デプロイ
  - Vercel デプロイ
  - Pro ユーザーでフィードページの動作確認
  - Free ユーザーでアップグレード案内の表示確認
  - Cron ジョブの動作確認
