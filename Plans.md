# Plans

> Phase 1 完了タスク (1-24): [docs/plans/archive-phase1.md](docs/plans/archive-phase1.md)
> Phase 2 完了タスク (25-48): [docs/plans/archive-phase2.md](docs/plans/archive-phase2.md)
> Phase 3〜5 完了タスク (49-90): [docs/plans/archive-phase3-5.md](docs/plans/archive-phase3-5.md)

---

## Phase 6（チャット風ダッシュボード — 羅針盤ファースト）

> **Goal:** ダッシュボードをチャット風UIに刷新。AIが対話で案内し、羅針盤を土台にタスク判定
> **Design:** `docs/plans/2026-02-18-chat-dashboard-design.md`

### タスク一覧

- [x] 91. ChatMessage コンポーネント作成 `cc:done`
  - AIメッセージの吹き出しUI（🤖アイコン + テキスト）
  - children を受け取り、テキスト or 任意のUI要素を表示
  - 出現アニメーション（opacity + translate-y、duration-500）
  - ファイル: `src/components/ChatMessage.tsx`

- [x] 92. CompassSummary コンポーネント作成 `cc:done`
  - GET /api/compass で羅針盤データ取得
  - コンパクト表示（タイトルを「/」区切りで1行表示）
  - 「編集」リンク → /compass ページへ遷移
  - データなし時は非表示（親が初回フローに切り替える）
  - ファイル: `src/components/CompassSummary.tsx`

- [x] 93. TaskChipInput コンポーネント作成
  - テキスト入力欄 + 「追加」ボタン
  - 追加されたタスクをチップ（タグ）で表示、×で削除
  - placeholder: 「例: 企画書の作成」
  - Enter キーでも追加可能
  - 最大10件制限（既存仕様と同じ）
  - コールバック: onTasksChange(tasks: string[])
  - ファイル: `src/components/TaskChipInput.tsx`

- [x] 94. TimeSelector コンポーネント作成
  - プリセットボタン: [30分] [1時間] [2時間] [3時間+]
  - 対応する値: 30, 60, 120, 180
  - 「カスタム」選択時にテキスト入力出現（分単位）
  - コールバック: onTimeSelect(minutes: number)
  - ファイル: `src/components/TimeSelector.tsx`

- [x] 95. EnergySelector コンポーネント作成 `cc:done`
  - 5段階ボタン（絵文字 + ラベル付き）
  - 1😩ぐったり / 2😐まあまあ / 3🙂普通 / 4😊元気 / 5🔥やる気MAX
  - コールバック: onEnergySelect(level: number)
  - aria 対応: role="radiogroup" + role="radio"（既存パターン踏襲）
  - ファイル: `src/components/EnergySelector.tsx`

- [x] 96. AdvancedSettings コンポーネント作成 `cc:done`
  - 折りたたみ式（デフォルト閉じ）
  - AIエンジン選択: openai / gemini / claude ボタン
  - モデル選択: ドロップダウン（features.json の available_models）
  - 自動フォールバック: チェックボックス
  - コールバック: onSettingsChange({ provider, model, autoFallback })
  - ファイル: `src/components/AdvancedSettings.tsx`

- [x] 97. ChatDashboard メインコンポーネント作成 `cc:done`
  - チャット風UIのコンテナ。全ステップの表示/非表示を管理
  - 状態: ChatStep = compass-setup | tasks | time | energy | confirm | loading | result
  - 初回（羅針盤なし）: compass-setup → tasks → time → energy → confirm → result
  - リピート（羅針盤あり）: tasks → time → energy → confirm → result
  - 各ステップ出現時に scrollIntoView({ behavior: "smooth" })
  - 既存ロジック移植: handleSubmit（/api/decide 呼び出し、ストリーミング、予算確認）
  - 既存ロジック移植: 履歴自動保存、compass relevance 取得
  - DecisionResult / BreakdownResult はそのまま再利用
  - ファイル: `src/components/ChatDashboard.tsx`

- [x] 98. ダッシュボードページ差し替え + ナビ改善 `cc:done`
  - dashboard/page.tsx: TaskDecisionForm → ChatDashboard に差し替え
  - ナビラベル変更: 「RAG」→「資料」、「コスト確認」→「コスト」
  - TaskDecisionForm は削除しない（/compare ページで引き続き使用）
  - ファイル: `src/app/(app)/dashboard/page.tsx`

- [x] 99. ビルド + テスト + レスポンシブ検証 `cc:done`
  - `npx vitest run` — 全テスト PASS
  - `npx next build` — ビルド成功
  - 手動テスト: 初回フロー / リピートフロー / スキップ / 詳細設定 / モバイル表示

---

## Phase 7（Compass提案 — 夢を忘れない提案エンジン Phase 1 MVP）

> **Goal:** 判断結果に「放置された夢からの具体アクション提案」を毎回カードで表示。ユーザーが採用すればタスクに追加して自動再判断
> **Design:** `docs/plans/2026-02-18-compass-suggestions-design.md`

### 優先度マトリクス

| 分類 | タスク |
|------|--------|
| **Required** | 100, 101, 102, 103, 104, 105 |
| **Recommended** | 106 |

### タスク一覧

- [x] 100. NeglectDetector — 放置された夢の検出ロジック `cc:done`
  - 今日入力されたタスク（文字列配列）と全CompassアイテムのEmbeddingを比較
  - 各Compassアイテムに対し、入力タスク群との最大コサイン類似度を算出
  - **最も類似度が低いCompassアイテム** = 今日忘れている夢として返す
  - `PrismaCompassVectorStore`（既存）と`OpenAIEmbedder`（既存）を再利用
  - Compassが0件の場合は null を返す
  - インターフェース: `detect(userId: string, taskQuery: string): Promise<NeglectedCompass | null>`
  - 型: `NeglectedCompass = { compassItemId: number; title: string; content: string; similarity: number }`
  - ファイル: `src/lib/compass/neglect-detector.ts`
  - テスト: `src/lib/compass/__tests__/neglect-detector.test.ts`
    - Compassが空のケース → null
    - 全Compassアイテムが高類似度のケース → 最も低いものを返す
    - Embedder/VectorStoreはモック注入

- [x] 101. suggest-action.md — Compass提案プロンプト作成 `cc:done`
  - LLMに「放置された夢 + 今日の時間・エネルギー」から具体的タスク1つを生成させるプロンプト
  - ルール: 時間内に完了可能 / エネルギーに合った負荷 / 曖昧禁止 / 提案は1つ / JSON出力
  - エネルギー別ガイド: 1-2→受動的活動、3→中程度、4-5→能動的・集中力要
  - JSON形式: `{ suggestedTask, reason, timeEstimate }`
  - ファイル: `prompts/compass/suggest-action.md`

- [x] 102. CompassSuggester — 検出+LLM生成の統合ロジック `cc:done`
  - `NeglectDetector` で放置された夢を検出
  - 検出結果 + 今日の時間・エネルギーを `suggest-action.md` プロンプトに埋め込み
  - LLMClient（既存インターフェース）で非ストリーミング呼び出し
  - JSONレスポンスをパースして `CompassSuggestion` 型で返す
  - 型: `CompassSuggestion = { compassItemId: number; compassTitle: string; suggestedTask: string; reason: string; timeEstimate: number }`
  - LLM呼び出し失敗時は null を返す（通常判断を妨げない）
  - ファイル: `src/lib/compass/compass-suggester.ts`
  - テスト: `src/lib/compass/__tests__/compass-suggester.test.ts`
    - NeglectDetector が null → null
    - LLM正常応答 → CompassSuggestion
    - LLMエラー → null（握りつぶし）

- [x] 103. POST /api/compass/suggest — APIエンドポイント `cc:done`
  - 認証: `requireAuth()` で userId 取得
  - リクエストボディ: `{ tasks: string[], timeMinutes: number, energyLevel: number }`
  - バリデーション: tasks非空、timeMinutes > 0、energyLevel 1-5
  - `CompassSuggester` を生成して `suggest()` 呼び出し
  - レスポンス: `{ suggestion: CompassSuggestion | null }`
  - エラー時も 200 + `{ suggestion: null }` で返す（フロントが失敗を気にしなくて良い）
  - ファイル: `src/app/api/compass/suggest/route.ts`

- [x] 104. CompassSuggestionCard — UIカードコンポーネント `cc:done`
  - Props: `suggestion: CompassSuggestion | null`, `loading: boolean`, `onAddTask: (task: string) => void`
  - suggestion が null または loading 中はカード非表示（またはスケルトン）
  - 表示内容: Compassタイトル（太字）、具体アクション（目立つスタイル）、時間見積もり、理由
  - 「このタスクを追加して再判断」ボタン → `onAddTask(suggestion.suggestedTask)` コールバック
  - フェードインアニメーション（通常判断完了後に表示）
  - ファイル: `src/components/CompassSuggestionCard.tsx`

- [x] 105. ChatDashboard 統合 — 並列fetch + 再判断フロー `cc:done`
  - state に `compassSuggestion: CompassSuggestion | null` と `compassSuggestionLoading: boolean` を追加
  - `handleSubmit` 内で `/api/decide`（ストリーミング）と `/api/compass/suggest`（非ストリーミング）を**並列fetch**
  - `/api/compass/suggest` が先に完了しても、通常判断の完了まではカード非表示
  - 結果画面の `DecisionResult` の下、session actionsの上に `CompassSuggestionCard` を配置
  - 「このタスクを追加して再判断」タップ時:
    1. `tasks` に `suggestedTask` を追加
    2. `dispatch({ type: "RESET" })` で状態リセット
    3. 同じ `availableTime` / `energyLevel` で `handleSubmit()` を自動実行
  - ファイル: `src/components/ChatDashboard.tsx`（既存編集）

- [x] 106. ビルド + テスト検証 `cc:done`
  - `npx vitest run` — 全テスト PASS
  - `npx next build` — ビルド成功
  - 手動テスト: Compass登録済みで判断実行 → 提案カード表示 → タップで再判断
