# Plans

> Phase 1 完了タスク (1-24): [docs/plans/archive-phase1.md](docs/plans/archive-phase1.md)
> Phase 2 完了タスク (25-48): [docs/plans/archive-phase2.md](docs/plans/archive-phase2.md)
> Phase 3.1 完了タスク (49-53): 下記参照

## Phase 3.1（E2E修正 + PWA化）✅ 完了

> **Design:** `docs/plans/2026-02-12-phase3-1-design.md`

- [x] 49. E2E 環境変数伝播修正 → 22/22 PASS `cc:done`
- [x] 50. PWA マニフェスト + アイコン `cc:done`
- [x] 51. Service Worker 導入 `cc:done`
- [x] 52. レスポンシブ微調整 `cc:done`
- [x] 53. 全体テスト＆ビルド＆PWA確認 `cc:done`

---

## Phase 3.2（モデル自由選択）

> **Goal:** UIドロップダウンでプロバイダー×モデルを自由に切替
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [ ] 54. features.json に available_models 追加 + pricing.json 更新
  - `available_models` マップ追加（各プロバイダーの利用可能モデル一覧）
  - Claude Opus の料金を pricing.json に追加
  - `getAvailableModels()` ヘルパー関数

- [ ] 55. TaskDecisionForm にモデルセレクター UI 追加
  - エンジン選択後にモデルドロップダウン表示
  - デフォルトは `default_model` の値
  - モデル名の横にコスト目安表示

- [ ] 56. API routes で model パラメータを活用
  - `/api/decide`, `/api/breakdown` で明示的 model 伝達
  - LLMClient に model パラメータ追加

- [ ] 57. 比較ページのモデル選択対応
  - 比較時に各プロバイダーの選択モデルを使用
  - 検証: ビルド + テスト PASS

---

## Phase 3.3（RAG連携）

> **Goal:** Markdown/PDF をベクトル検索し判定精度を向上
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [ ] 58. sqlite-vec セットアップ + VectorStore 実装
  - sqlite-vec 拡張インストール
  - VectorStore interface + Prisma/SQLite 実装
  - テスト作成

- [ ] 59. Chunker（MD/PDF パーサー + 分割）実装
  - Markdown 分割（見出し区切り + サイズ制限）
  - PDF パーサー（pdf-parse）
  - チャンクサイズ: 500トークン、100オーバーラップ

- [ ] 60. Embedder（OpenAI Embeddings）実装
  - text-embedding-3-small API 呼び出し
  - バッチ処理対応
  - テスト作成

- [ ] 61. Retriever + プロンプト注入 実装
  - コサイン類似度で top-k=3 検索
  - 検索結果をプロンプトのコンテキストセクションに注入

- [ ] 62. /api/documents アップロード API + UI
  - ファイルアップロード → チャンク分割 → エンベディング → 保存
  - ドキュメント管理 UI（一覧・削除）

- [ ] 63. TaskDecisionEngine への RAG 統合
  - 判定時に関連コンテキストを自動検索・注入
  - 検証: ビルド + テスト PASS

---

## Phase 3.4（Web Push通知）

> **Goal:** PWA Push通知でリマインダーと予算アラートを送信
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [ ] 64. VAPID キー生成 + web-push セットアップ
  - `npm install web-push` + VAPID キーペア生成
  - 環境変数に VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY

- [ ] 65. Push サブスクリプション管理（API + DB）
  - Prisma に PushSubscription モデル追加
  - `/api/push/subscribe`, `/api/push/unsubscribe` エンドポイント

- [ ] 66. SW push イベントハンドラ追加
  - `public/sw.js` に push / notificationclick ハンドラ
  - 通知タップでアプリ画面に遷移

- [ ] 67. 通知設定 UI + リマインダースケジュール
  - 通知ON/OFF トグル + 時刻設定
  - 予算アラート通知（80%超過時）

- [ ] 68. 全体検証
  - ビルド + テスト PASS + Push通知動作確認
