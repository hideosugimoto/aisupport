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
