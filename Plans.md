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

## Phase 3.2（モデル自由選択）✅ 完了

> **Goal:** UIドロップダウンでプロバイダー×モデルを自由に切替
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [x] 54. features.json に available_models 追加 + pricing.json 更新 `cc:done`
- [x] 55. TaskDecisionForm にモデルセレクター UI 追加 `cc:done`
- [x] 56. API routes で model パラメータを活用 `cc:done`
- [x] 57. 比較ページのモデル選択対応 → ビルド + 124テスト PASS `cc:done`

---

## Phase 3.3（RAG連携）✅ 完了

> **Goal:** Markdown/PDF をベクトル検索し判定精度を向上
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [x] 58. VectorStore 実装（Prisma + cosine similarity in JS） `cc:done`
- [x] 59. Chunker（MD/PDF パーサー + 分割）+ テスト `cc:done`
- [x] 60. Embedder（OpenAI text-embedding-3-small）`cc:done`
- [x] 61. Retriever + プロンプト注入 `cc:done`
- [x] 62. /api/documents アップロード API + UI `cc:done`
- [x] 63. TaskDecisionEngine への RAG 統合 → ビルド + 132テスト PASS `cc:done`

---

## Phase 3.4（Web Push通知）✅ 完了

> **Goal:** PWA Push通知でリマインダーと予算アラートを送信
> **Design:** `docs/plans/2026-02-12-phase3-2-4-design.md`

- [x] 64. VAPID キー生成 + web-push セットアップ `cc:done`
- [x] 65. Push サブスクリプション管理（API + DB） `cc:done`
- [x] 66. SW push イベントハンドラ追加 `cc:done`
- [x] 67. 通知設定 UI + リマインダースケジュール `cc:done`
- [x] 68. 全体検証 → ビルド + 132テスト PASS `cc:done`

---

## 🟢 完了済みのタスク（Phase 3.5以降）

- [x] 69. key-resolver テストファイル作成 `cc:done`
  - 依頼内容: key-resolver.ts の Vitest テストを作成（ユーザーキー/プラットフォームキー/復号化失敗の各ケース）
  - 追加日時: 2026-02-14 15:00
  - 完了: 2026-02-14 18:24 — 10テスト全てPASS

- [x] 70. レビュー指摘対応 Round 2（Critical 3 + Major 9 + Minor 16） `cc:done`
  - Critical: IP spoofing対策（x-real-ip優先）、暗号化鍵validateEncryptionKey追加、Webhook冪等性チェック
  - Major: ファイル名サニタイズ強化、VAPID 503返却、delete-account Clerk優先、RAG Top-K heap最適化
  - A11y: label/input関連付け、aria-busy、role="alert"、チェックボックスlabel
  - Minor: rate limiter改善（段階的削除）、Webhook null subscriptionチェック
  - 完了: 2026-02-14 — 193テスト全PASS + ビルド成功

- [x] 71. レビュー指摘対応 Round 3（Critical 1 + Warning 2） `cc:done`
  - Critical: instrumentation.ts 作成 — validateEncryptionKey() を起動時に実行
  - Warning: delete-account 順序改善 — DB削除を最優先（個人情報保護）、Clerk削除は最後に実行
  - 完了: 2026-02-14 — 193テスト全PASS + ビルド成功

- [x] 77. CompassRetriever + CompassVectorStore `cc:done`
  - vector-utils.ts 作成（cosineSimilarity, embeddingToBuffer, bufferToFloat32 を抽出）
  - compass-vector-store.ts 作成（CompassChunk テーブルを検索、batch + Top-K bounded パターン）
  - compass-retriever.ts 作成（Retriever インターフェース実装、羅針盤専用のコンテキスト構築）
  - vector-store.ts を vector-utils からインポートするようリファクタリング
  - 完了: 2026-02-14 19:50 — 193テスト全PASS + ビルド成功

---

## Phase 4（羅針盤マップ — Compass Map）

> **Goal:** ユーザーの夢・目標・インスピレーションを蓄積し、日々のタスク判定に「羅針盤」として注入
> **Design:** `.claude/plans/replicated-weaving-marshmallow.md`

- [x] 72. Prisma モデル追加（CompassItem + CompassChunk） `cc:done`
- [x] 73. Compass CRUD API（/api/compass） `cc:done`
- [x] 74. URL Processor（fetch + AI要約） `cc:done`
- [x] 75. Image Processor（Vision API） `cc:done`
- [x] 76. File Processor（RAGパイプライン再利用） `cc:done`
- [x] 77. CompassRetriever + CompassVectorStore `cc:done`
- [x] 78. プロンプト修正 + TaskDecisionEngine 統合 `cc:done`
  - TaskDecisionEngine に compassRetriever フィールド追加 + setCompassRetriever() メソッド実装
  - fetchCompassContext() メソッド追加（RAG パターンと同様）
  - decide() / decideStream() で compassContext を取得してプロンプトに注入
  - DecisionResult に compassRelevance フィールド追加（羅針盤マッチ情報を返却）
  - buildTaskDecisionMessages() に compassContext 引数追加（compass → RAG の順で注入）
  - prompts/task-decision/system.md + v2/system.md に羅針盤考慮の指示を追加
  - /api/decide ルートで compassRetriever をセットアップ（embedder 再利用）
  - 完了: 2026-02-14 — 189テスト PASS + ビルド成功
- [x] 79. Compass ページ UI `cc:done`
  - CompassAddForm.tsx 作成（テキスト/URL/画像の3タブ切替、プレビュー機能、aria属性）
  - CompassItemCard.tsx 作成（削除確認UI、typeアイコン、truncated content表示）
  - /compass ページ作成（一覧表示、空状態メッセージ、loading状態）
  - ナビゲーションリンク追加（dashboard, documents ページに羅針盤リンク追加）
  - 完了: 2026-02-14 — ビルド成功
- [x] 80. 判定結果に羅針盤関連度を表示 `cc:done`
  - DecisionResult.tsx にcompassRelevance表示（青色バッジ、羅針盤アイコン、関連度%）
  - 羅針盤未登録時は登録誘導リンク表示
  - TaskDecisionForm にSET_COMPASSアクション追加、決定完了後にcompassデータ取得
  - plan-gate.test.ts のcompassフィールド不整合を修正
  - 完了: 2026-02-14 — 233テスト全PASS + ビルド成功
- [x] 81. テスト + ビルド検証 `cc:done`
  - url-processor.test.ts: 6テスト（title抽出、要約生成、HTTPエラー、timeout、truncate、script除去）
  - image-processor.test.ts: 10テスト（validateImage: サイズ制限、MIME型チェック、processImage: 説明生成）
  - compass-retriever.test.ts: 8テスト（検索、空結果、topK、類似度表示、ファイル名、番号付け、区切り、ヘッダー）
  - vector-utils.test.ts: 16テスト（cosineSimilarity: 同一/直交/反対/ゼロ/高次元、round-trip: 保存/復元/極値）
  - 完了: 2026-02-14 20:00 — 233テスト全PASS + ビルド成功

---

## Phase 4.1（レビュー指摘対応 Round 4）

> **Goal:** Phase 4 レビューの Critical/Major 修正

- [x] 82. レビュー指摘対応 Round 4（Critical 8 + Major 5） `cc:done`
  - Security: SSRF対策（内部URL/プライベートIPブロック）、プロンプトインジェクション防御（区切り境界）、parseInt範囲チェック
  - Performance: Promise.all 並列リトリーバル、プロンプトサイズ制限（MAX_CONTEXT_CHARS=4000）
  - A11y: タブ role="tablist"/role="tab"、削除確認 role="alert"、Loading aria-live、画像alt改善、emoji aria-hidden
  - Quality: console.log除去、AbortError区別
  - 完了: 2026-02-14 — 233テスト全PASS + ビルド成功
