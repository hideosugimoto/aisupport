# Phase 6〜7 完了タスク (91-106)

## Phase 6（チャット風ダッシュボード — 羅針盤ファースト）✅ 完了

> **Goal:** ダッシュボードをチャット風UIに刷新。AIが対話で案内し、羅針盤を土台にタスク判定
> **Design:** `docs/plans/2026-02-18-chat-dashboard-design.md`

### タスク一覧

- [x] 91. ChatMessage コンポーネント作成 `cc:done`
- [x] 92. CompassSummary コンポーネント作成 `cc:done`
- [x] 93. TaskChipInput コンポーネント作成 `cc:done`
- [x] 94. TimeSelector コンポーネント作成 `cc:done`
- [x] 95. EnergySelector コンポーネント作成 `cc:done`
- [x] 96. AdvancedSettings コンポーネント作成 `cc:done`
- [x] 97. ChatDashboard メインコンポーネント作成 `cc:done`
- [x] 98. ダッシュボードページ差し替え + ナビ改善 `cc:done`
- [x] 99. ビルド + テスト + レスポンシブ検証 `cc:done`

---

## Phase 7（Compass提案 — 夢を忘れない提案エンジン Phase 1 MVP）✅ 完了

> **Goal:** 判断結果に「放置された夢からの具体アクション提案」を毎回カードで表示。ユーザーが採用すればタスクに追加して自動再判断
> **Design:** `docs/plans/2026-02-18-compass-suggestions-design.md`

### タスク一覧

- [x] 100. NeglectDetector — 放置された夢の検出ロジック `cc:done`
- [x] 101. suggest-action.md — Compass提案プロンプト作成 `cc:done`
- [x] 102. CompassSuggester — 検出+LLM生成の統合ロジック `cc:done`
- [x] 103. POST /api/compass/suggest — APIエンドポイント `cc:done`
- [x] 104. CompassSuggestionCard — UIカードコンポーネント `cc:done`
- [x] 105. ChatDashboard 統合 — 並列fetch + 再判断フロー `cc:done`
- [x] 106. ビルド + テスト検証 `cc:done`
