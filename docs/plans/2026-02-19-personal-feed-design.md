# パーソナルフィード機能 設計書

## 概要

羅針盤データ（ユーザーの目標・関心事）をもとに、パーソナライズされたニュース・ブログ記事を自動収集し表示する機能。

## 方針決定

| 項目 | 決定 |
|------|------|
| 取得方式 | ハイブリッド（定期バッチ + 手動リフレッシュ） |
| 情報ソース（MVP） | Google News RSS（無料、APIキー不要） |
| キーワード生成 | LLM自動生成（羅針盤テキスト → gpt-4o-mini） |
| ページ構成 | `/feed` 1ページ + タブ切替（ニュース / ブログ・コラム） |
| 記事表示 | シンプル一覧（新しい順、スコアリングなし） |
| プラン制限 | Pro限定 |

## アーキテクチャ

```
羅針盤データ → LLM → 検索キーワード生成 → Google News RSS → 記事DB保存
                                                                  ↓
                                    /feed ページ ← DB読み取り ← FeedArticle
                                        ↑
                            「最新を取得」ボタン → API → 再取得
```

## DBスキーマ

```prisma
model FeedKeyword {
  id        Int      @id @default(autoincrement())
  userId    String
  keyword   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

model FeedArticle {
  id          Int      @id @default(autoincrement())
  userId      String
  title       String
  url         String
  source      String   // "google_news", 将来: "rss", "web_search"
  category    String   // "news" or "blog"
  snippet     String   // 記事の概要テキスト
  publishedAt DateTime
  fetchedAt   DateTime @default(now())
  keyword     String   // どのキーワードで取得したか
  isRead      Boolean  @default(false)

  @@unique([userId, url])  // 同じ記事の重複防止
  @@index([userId, category])
  @@index([userId, fetchedAt])
}
```

## API Routes

| メソッド | パス | 機能 |
|---------|------|------|
| GET | `/api/feed` | 記事一覧取得（category, page パラメータ） |
| POST | `/api/feed/refresh` | 手動で最新記事を取得 |
| POST | `/api/feed/keywords/generate` | 羅針盤から検索キーワードを再生成 |
| GET | `/api/feed/keywords` | 現在のキーワード一覧 |
| PATCH | `/api/feed/[id]` | 既読フラグ更新 |
| POST | `/api/feed/cron` | バッチ取得（CRON_SECRET認証） |

## 処理フロー

### キーワード生成（`src/lib/feed/keyword-generator.ts`）

1. ユーザーの羅針盤アイテム全件をDB取得
2. タイトルとコンテンツを連結してLLMに渡す
3. プロンプト（`prompts/feed/generate-keywords.md`）で検索キーワード5〜10個を生成
4. JSON配列で返却、`FeedKeyword`テーブルに保存

### ニュース取得（`src/lib/feed/news-fetcher.ts`）

1. `FeedKeyword` からユーザーのキーワード一覧取得
2. 各キーワードでGoogle News RSSをfetch
3. XMLをパース（`fast-xml-parser` を使用）
4. 重複チェック（`@@unique([userId, url])`）して新規のみDB保存
5. カテゴリは「news」固定（将来ブログ/RSS対応時に「blog」を追加）

### バッチ処理

- Vercel Cron（`vercel.json` に設定）で1日1回実行
- `/api/feed/cron` エンドポイント（CRON_SECRET認証）
- 30日以上経過した記事は自動削除

## ファイル構成

```
src/lib/feed/
  keyword-generator.ts    # 羅針盤 → LLM → キーワード生成
  news-fetcher.ts         # Google News RSS取得・パース
  types.ts                # 型定義

src/app/api/feed/
  route.ts                # GET: 記事一覧
  refresh/route.ts        # POST: 手動取得
  keywords/
    route.ts              # GET: キーワード一覧
    generate/route.ts     # POST: キーワード再生成
  [id]/route.ts           # PATCH: 既読更新
  cron/route.ts           # POST: バッチ処理

src/app/(app)/feed/
  page.tsx                # メインページ

prompts/feed/
  generate-keywords.md    # キーワード生成プロンプト

config/feed.json          # 設定値（件数制限、キーワード数上限など）
```

## UIコンポーネント

```
FeedPage                  # サーバーコンポーネント（プラン判定）
├── FeedTabs              # タブ切替（ニュース / ブログ・コラム）
│   ├── ArticleCard       # 記事カード（タイトル、ソース、日時、概要）
│   └── LoadMoreButton    # ページネーション
├── KeywordChips          # キーワード表示
├── RefreshButton         # 手動取得ボタン（ローディング状態付き）
├── EmptyState            # キーワード未生成時の案内
└── ProUpgradePrompt      # Freeユーザー向けアップグレード案内
```

## 将来の拡張ポイント

- ブログ・コラムタブ: ユーザーがRSSフィードURLを登録 → 定期取得
- Web検索API（Bing/Google）追加で幅広い記事取得
- エンベディング類似度による関連度スコアリング
- 「お気に入り」「あとで読む」機能
- プッシュ通知（注目記事があった場合）
