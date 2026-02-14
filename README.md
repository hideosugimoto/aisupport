# AI 意思決定アシスタント

「今日やるべきタスクをAIが選ぶ」意思決定アシスタント。
ユーザーの目標・夢・ワクワク（羅針盤）を蓄積し、日々のタスク判定に活用します。

## 主な機能

- **タスク判定**: 今日のタスクをAIが優先度付きで選定
- **比較判定**: 2つの選択肢をAIが多角的に比較
- **羅針盤マップ**: テキスト/URL/画像で目標・インスピレーションを蓄積（RAG検索）
- **マルチLLM**: OpenAI / Gemini / Claude から選択可能（BYOK対応）
- **履歴・コスト管理**: 判定履歴の閲覧とAPI利用コストの可視化
- **PWA対応**: オフライン対応 + Web Push 通知
- **Free/Pro プラン**: Stripe による課金管理

## 技術スタック

| 区分 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| 認証 | Clerk |
| データベース | PostgreSQL (Supabase) + Prisma ORM |
| LLM | OpenAI / Google AI (Gemini) / Anthropic (Claude) |
| 決済 | Stripe |
| テスト | Vitest + Playwright (E2E) |
| ホスティング | Vercel |

---

## 必要なアカウント

| # | サービス | 用途 | 必須 | 無料枠 |
|---|---------|------|:----:|--------|
| 1 | [Clerk](https://clerk.com) | ユーザー認証 | **必須** | 10,000 MAU |
| 2 | [Supabase](https://supabase.com) | PostgreSQL データベース | **必須** | 500MB / 2プロジェクト |
| 3 | [OpenAI](https://platform.openai.com) | LLM + Embedding + Vision | **必須** | なし（従量課金） |
| 4 | [Stripe](https://stripe.com) | Pro プラン課金 | 課金時 | 決済手数料のみ |
| 5 | [Google AI](https://aistudio.google.com) | Gemini モデル | 任意 | 無料枠あり |
| 6 | [Anthropic](https://console.anthropic.com) | Claude モデル | 任意 | なし（従量課金） |
| 7 | [Vercel](https://vercel.com) | ホスティング | **必須** | Hobby プラン無料 |

---

## アカウント作成手順

### 1. Clerk（認証）

1. https://clerk.com でアカウント作成
2. ダッシュボードで **「Create application」**
3. 認証方法を選択（Email、Google、GitHub など好みで）
4. **API Keys** ページから以下を取得:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_test_...)
   - `CLERK_SECRET_KEY` (sk_test_...)

> 本番公開時は Production インスタンスに切り替えると `pk_live_` / `sk_live_` キーになります。

### 2. Supabase（データベース）

1. https://supabase.com でアカウント作成
2. **「New Project」** で新規プロジェクト作成
   - Region: `Northeast Asia (Tokyo)` 推奨
   - パスワードを設定（接続文字列に使用）
3. **Settings → Database → Connection string** から取得:

| 用途 | ポート | 接続モード | 環境変数 |
|------|:------:|-----------|---------|
| アプリ | 6543 | Transaction (pgbouncer) | `DATABASE_URL` |
| マイグレーション | 5432 | Session | `DIRECT_URL` |

```
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 3. OpenAI（LLM・Embedding・Vision）

1. https://platform.openai.com でアカウント作成
2. **API Keys** ページで **「Create new secret key」**
3. **Billing** でクレジットを追加（$5〜で十分始められます）
4. 取得するキー: `OPENAI_API_KEY` (sk-...)

> 使用モデル: gpt-4o-mini（判定）、text-embedding-3-small（RAG/羅針盤）、gpt-4o-mini Vision（画像分析）

### 4. Stripe（課金）— 課金機能を使う場合

1. https://stripe.com でアカウント作成
2. **テストモード** で開発を進める（ダッシュボード右上のトグル）
3. **Products** で Pro プランの商品と価格を作成:
   - 商品名: 例「Pro プラン」
   - 価格: 例「月額 ¥980」
   - 作成後、Price ID (`price_...`) をメモ
4. 以下のキーを取得:

| キー | 取得場所 |
|------|---------|
| `STRIPE_SECRET_KEY` | Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | Developers → API keys |
| `STRIPE_PRO_PRICE_ID` | Products → 作成した価格の ID |
| `STRIPE_WEBHOOK_SECRET` | 下記 Webhook 設定で取得 |

5. **Webhook の設定**:

   ローカル開発時:
   ```bash
   # Stripe CLI をインストール後
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   # 表示される whsec_... を STRIPE_WEBHOOK_SECRET に設定
   ```

   本番（Vercel デプロイ後）:
   - Developers → Webhooks → **「Add endpoint」**
   - URL: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - 作成後の Signing secret を `STRIPE_WEBHOOK_SECRET` に設定

### 5. Google AI（任意）

1. https://aistudio.google.com にアクセス
2. **「Get API key」** でキーを作成
3. 取得するキー: `GOOGLE_AI_API_KEY` (AI...)

### 6. Anthropic（任意）

1. https://console.anthropic.com でアカウント作成
2. **API Keys** でキーを作成
3. 取得するキー: `ANTHROPIC_API_KEY` (sk-ant-...)

---

## ローカル開発セットアップ

### 前提条件

- Node.js 20+
- npm

### 手順

```bash
# 1. リポジトリのクローン
git clone <repository-url>
cd aisupport

# 2. 依存パッケージのインストール
npm install

# 3. 環境変数ファイルの作成
cp .env.local.example .env.local
# → .env.local を開いて各キーを設定（次のセクション参照）

# 4. 暗号化キーの生成（BYOK用）
openssl rand -hex 32
# → 出力された64桁のhexを API_KEY_ENCRYPTION_KEY に設定

# 5. VAPID キーの生成（Web Push用）
node scripts/generate-vapid-keys.js
# → 出力されたキーを .env.local に設定

# 6. データベースのマイグレーション
npx prisma migrate deploy

# 7. 開発サーバーの起動
npm run dev
```

http://localhost:3000 でアクセスできます。

### .env.local の設定内容

```env
# DB (Supabase PostgreSQL)
DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres

# LLM API Keys
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...           # 任意
ANTHROPIC_API_KEY=sk-ant-...      # 任意

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# BYOK Encryption (64-char hex = 32 bytes)
API_KEY_ENCRYPTION_KEY=<openssl rand -hex 32 の出力>

# VAPID (Web Push)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generate-vapid-keys.js の出力>
VAPID_PRIVATE_KEY=<generate-vapid-keys.js の出力>
VAPID_EMAIL=mailto:your-email@example.com
```

---

## Vercel デプロイ手順

### 1. Vercel にプロジェクトをインポート

1. https://vercel.com でアカウント作成（GitHub 連携推奨）
2. **「Add New → Project」**
3. GitHub リポジトリを選択して **「Import」**
4. Framework Preset が「Next.js」になっていることを確認
5. **「Deploy」** を押す（初回は環境変数未設定のため失敗してOK）

### 2. 環境変数を設定

1. Vercel ダッシュボード → プロジェクト → **Settings → Environment Variables**
2. 以下の変数を全て登録:

| Key | 説明 | Environment |
|-----|------|-------------|
| `DATABASE_URL` | Supabase 接続文字列 (port 6543) | Production, Preview |
| `DIRECT_URL` | Supabase 接続文字列 (port 5432) | Production, Preview |
| `OPENAI_API_KEY` | OpenAI API キー | Production, Preview |
| `GOOGLE_AI_API_KEY` | Google AI キー（任意） | Production, Preview |
| `ANTHROPIC_API_KEY` | Anthropic キー（任意） | Production, Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公開キー | Production, Preview |
| `CLERK_SECRET_KEY` | Clerk シークレットキー | Production, Preview |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | Production |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 公開キー | Production |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook シークレット | Production |
| `STRIPE_PRO_PRICE_ID` | Stripe Pro 価格 ID | Production |
| `NEXT_PUBLIC_APP_URL` | デプロイ先 URL | Production |
| `API_KEY_ENCRYPTION_KEY` | 暗号化キー (64桁 hex) | Production |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID 公開キー | Production |
| `VAPID_PRIVATE_KEY` | VAPID 秘密キー | Production |
| `VAPID_EMAIL` | VAPID メールアドレス | Production |

> **一括登録**: 入力欄の **「.env paste」** ボタンから `.env.local` の内容をペーストして一括登録も可能です。

> **本番用キーに注意**: Clerk と Stripe は本番用キー（`pk_live_` / `sk_live_`）に切り替えてください。

### 3. 再デプロイ

環境変数設定後、**Deployments → 最新のデプロイ → 「Redeploy」** を押すと反映されます。
以降は `git push` するだけで自動デプロイされます。

### 4. Stripe Webhook を本番 URL に設定

1. Stripe ダッシュボード → Developers → Webhooks → **「Add endpoint」**
2. Endpoint URL: `https://your-domain.vercel.app/api/stripe/webhook`
3. Listen to events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Signing secret を Vercel の `STRIPE_WEBHOOK_SECRET` に設定して再デプロイ

### 5. Clerk の本番設定

1. Clerk ダッシュボード → Production インスタンスに切替
2. **Domains** にデプロイ先のドメインを追加
3. 本番用キー (`pk_live_`, `sk_live_`) を Vercel 環境変数に設定

---

## アーキテクチャ

```
ユーザー (ブラウザ / PWA)
  ↓
Vercel (Next.js)         ← サーバー管理不要
  ├→ Clerk               ← 認証
  ├→ Supabase            ← PostgreSQL
  ├→ OpenAI API          ← LLM / Embedding / Vision
  ├→ Google AI API       ← Gemini (任意)
  ├→ Anthropic API       ← Claude (任意)
  └→ Stripe              ← 課金
```

## 費用の目安（個人利用）

| サービス | 月額目安 |
|---------|---------|
| Vercel (Hobby) | 無料 |
| Clerk | 無料 (10,000 MAU以内) |
| Supabase | 無料 (500MB以内) |
| OpenAI | $1〜5 |
| Stripe | $0 (決済発生時のみ手数料) |
| **合計** | **約 $1〜5 / 月** |

---

## 開発コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動
npm run lint         # ESLint
npm run test         # Vitest 実行
npm run test:watch   # Vitest ウォッチモード
npm run dev:e2e      # E2E テスト用開発サーバー
npm run test:e2e     # Playwright E2E テスト
```

## ディレクトリ構成

```
aisupport/
├── src/
│   ├── app/                  # Next.js App Router (ページ・API)
│   │   ├── (app)/            # 認証必須ページ (ダッシュボード・比較・履歴・コスト・羅針盤・ドキュメント・設定)
│   │   └── api/              # API Routes (decide, compare, compass, stripe, push...)
│   ├── components/           # React コンポーネント
│   └── lib/                  # ビジネスロジック (Next.js 非依存)
│       ├── llm/              # LLMClient インターフェース + 各プロバイダ実装
│       ├── decision/         # タスク判定エンジン
│       ├── rag/              # RAG パイプライン (chunker, embedder, vector-store, retriever)
│       ├── compass/          # 羅針盤 (URL/画像処理, vector-store, retriever)
│       ├── billing/          # プラン判定・APIキー解決
│       ├── auth/             # 認証ヘルパー
│       ├── crypto/           # BYOK暗号化
│       └── stripe/           # Stripe クライアント
├── prompts/                  # プロンプトテンプレート (外部ファイル管理)
├── config/                   # 設定ファイル (features.json, plans.json, compass.json)
└── prisma/                   # Prisma スキーマ・マイグレーション
```
