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
