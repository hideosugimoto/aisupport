# セキュリティ仕様書

更新日: 2026-04-01

## 1. 認証・認可

| 項目 | 実装 |
|------|------|
| 認証プロバイダ | Clerk |
| セッション管理 | Clerk トークンベース（Secure/HttpOnly Cookie） |
| 管理者判定 | Clerk publicMetadata `role: "admin"` |
| 2段階認証 | Clerk ダッシュボードで有効化（TOTP対応） |
| 停止ユーザー | `user_statuses` テーブルで管理、API呼び出し時にチェック |

## 2. アクセス制御

| ルート | 認証 | 権限 |
|--------|------|------|
| `/`, `/sign-in`, `/sign-up`, `/terms`, `/privacy` | 不要 | 公開 |
| `/share/[id]` | 不要 | 公開（共有リンク） |
| `/dashboard`, `/api/*` | Clerk認証必須 | 一般ユーザー |
| `/admin/*`, `/api/admin/*` | Clerk認証 + admin role | 管理者のみ |
| `/api/stripe/webhook` | Stripe署名検証 | Stripeのみ |

## 3. レート制限

| 対象 | 制限 | ウィンドウ |
|------|------|----------|
| 全API（/api/*） | 10リクエスト | 60秒/IP |
| ログイン（/sign-in, /sign-up） | 10回 | 30分/IP |
| 共有リンク作成 | 10件/日 | 1日/ユーザー |
| LLM判定（Free） | 10回/月 | 月間/ユーザー |

## 4. セキュリティヘッダー

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: [環境別設定]
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 5. データ保護

| 項目 | 方式 |
|------|------|
| クレジットカード情報 | **自社では保持しない**（Stripe管理） |
| ユーザーAPIキー（BYOK） | AES-256-GCM で暗号化、DBに保存 |
| セッションデータ | Clerk管理（サーバーサイド） |
| 環境変数 | Vercel環境変数（暗号化保存） |

## 6. 脆弱性対策

| 攻撃 | 対策 |
|------|------|
| SQLインジェクション | Prisma ORM（パラメータ化クエリ） |
| XSS | React自動エスケープ + CSP |
| CSRF | SameSite Cookie（Clerk管理） |
| クリックジャッキング | X-Frame-Options: DENY |
| 入力値攻撃 | Zod/手動バリデーション、content長制限 |
| エラー情報漏洩 | ユーザー向けエラーは汎用メッセージ、詳細はサーバーログのみ |

## 7. 管理画面セキュリティ

- 管理者は Clerk で 2FA 必須に設定
- 管理操作は全て `admin_logs` テーブルに記録
- アカウント停止/再開の操作ログ（管理者ID、対象ID、IP、理由）

## 8. 不正決済対策

- Stripe Checkout / Payment Element 使用（PCI DSS準拠）
- 3Dセキュア: Stripe側で自動適用
- Webhook署名検証によるイベント認証
- カード情報は自社サーバーを一切通過しない

## 9. 運用方針

- フレームワーク・ライブラリは定期的にアップデート
- Vercel自動デプロイで最新状態を維持
- 本ドキュメントはセキュリティ変更時に更新する
