# Phase 3.1 設計書: E2E修正 + PWA化

## ゴール

E2Eテストを全件グリーン(22/22)にし、PWA対応でスマホ・PCの両方からホーム画面アイコンで即起動できるようにする。

## 背景

- Phase 1-2 完了: 全8機能実装済み、124ユニットテスト PASS
- E2E 20/22 PASS: 2件が環境変数伝播の問題で失敗中
- 要件定義書 セクション10 Phase3 に「PWA本格対応」が記載

## E2E テスト修正

### 問題分析

失敗テスト:
1. `task-flow.spec.ts` — "complete full task decision flow"
2. `task-flow.spec.ts` — "request task breakdown after decision"

両方とも Rate Limit エラーが表示される = E2E_MOCK が有効になっていない。

### 原因

`playwright.config.ts` で `reuseExistingServer: !process.env.CI` を設定。
ローカルでは既存の dev server を再利用するが、既存サーバーは `E2E_MOCK=true` なしで起動されている可能性がある。

### 修正方針

- `playwright.config.ts` の `webServer` 設定を見直し、E2E テスト用サーバーが確実に `E2E_MOCK=true` で起動されるようにする
- テスト側でモックレスポンスを期待するアサーションを堅牢化

## PWA 対応

### 技術選定

- `@serwist/next` — next-pwa の後継、App Router 対応良好
- オフライン不要 → NetworkFirst 戦略（常にサーバー優先）
- `standalone` モードでブラウザUI非表示

### 実装内容

1. **マニフェスト** (`public/manifest.json`)
   - name: "AI意思決定アシスタント"
   - short_name: "AI判断"
   - display: "standalone"
   - theme_color / background_color
   - icons: 192x192, 512x512

2. **アイコン**
   - SVG ベースデザイン → PNG 変換
   - 192x192 (ホーム画面) + 512x512 (スプラッシュ)
   - apple-touch-icon 対応

3. **Service Worker**
   - `@serwist/next` による自動生成
   - NetworkFirst: API呼び出しは常にネットワーク優先
   - 静的アセットのみキャッシュ（JS/CSS/画像）

4. **メタタグ** (`layout.tsx`)
   - viewport: `width=device-width, initial-scale=1`
   - theme-color
   - apple-mobile-web-app-capable
   - manifest リンク

### レスポンシブ

- Tailwind の既存レスポンシブ対応を活用
- タッチターゲット: 最低 44x44px 確認
- モバイル表示の微調整（パディング、フォントサイズ）

## タスク一覧

| # | タスク | 内容 |
|---|--------|------|
| 49 | E2E テスト修正 | 環境変数伝播修正、22/22 PASS |
| 50 | PWA マニフェスト + アイコン | manifest.json, アイコン, head メタタグ |
| 51 | Service Worker 導入 | @serwist/next セットアップ |
| 52 | レスポンシブ微調整 | タッチターゲット、モバイル表示調整 |
| 53 | 全体検証 | E2E全件 + ビルド + Lighthouse PWA |
