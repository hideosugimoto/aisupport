# AI Support

[English](README.md)

AI を活用した意思決定アシスタント。タスクの優先順位付け、選択肢の比較、ニュースフィードを、あなたの目標や価値観に沿って支援します。

## コア機能

- **羅針盤（Compass）** — テキスト/URL/画像で目標・夢・価値観を蓄積。タスク判定・比較判定・週次レビューすべての判断基準として中核を担う
- **タスク判定** — タスク・エネルギーレベル・利用可能時間を入力すると、羅針盤に基づいて AI が最適タスクを提案。ストリーミング応答に羅針盤の関連度やコンテキスト情報をリアルタイムで付与
- **比較判定** — 同じ入力を複数 AI エンジン（OpenAI / Gemini / Claude）で同時判定。羅針盤を共通基準として比較し、どの羅針盤項目が判断に影響したかを表示
- **週次レビュー** — 過去1週間の判定履歴を羅針盤と照合し、見落とされた目標を検出。改善提案を生成

## 周辺機能

- **ドキュメント RAG** — PDF やテキストファイルをアップロード。AI が判定時の追加コンテキストとして活用
- **ニュースフィード** — キーワードを設定すると、毎日自動で関連ニュースを収集。メールダイジェスト配信にも対応
- **コストダッシュボード** — LLM API の利用状況とコストをリアルタイムで可視化。予算アラート付き
- **プッシュ通知** — Web Push によるデイリーリマインダーと予算アラート
- **BYOK（自分のAPIキーを使用）** — OpenAI / Google AI / Anthropic の自分のキーを登録可能（暗号化保存）
- **Stripe 課金** — Free / Pro プランの Stripe サブスクリプション管理

## 技術スタック

| 区分 | 技術 |
|------|------|
| フレームワーク | [Next.js 16](https://nextjs.org/) (App Router) |
| 言語 | TypeScript |
| データベース | PostgreSQL ([Supabase](https://supabase.com/)) + [Prisma](https://www.prisma.io/) |
| 認証 | [Clerk](https://clerk.com/) |
| LLM | OpenAI (gpt-4o-mini) / Google AI (Gemini) / Anthropic (Claude) |
| 決済 | [Stripe](https://stripe.com/) |
| メール | [Resend](https://resend.com/) |
| プッシュ通知 | Web Push (VAPID) |
| PDF 解析 | [unpdf](https://github.com/unjs/unpdf) |
| テスト | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| スタイリング | [Tailwind CSS v4](https://tailwindcss.com/) |
| ホスティング | [Vercel](https://vercel.com/) |

## アーキテクチャ

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # 認証必須ページ
│   │   ├── dashboard/      # ダッシュボード
│   │   ├── compare/        # 比較判定
│   │   ├── compass/        # 羅針盤（目標・価値観）
│   │   ├── documents/      # ドキュメント管理
│   │   ├── feed/           # ニュースフィード
│   │   ├── cost/           # コスト管理
│   │   ├── history/        # 判定履歴
│   │   └── settings/       # 設定
│   ├── (marketing)/        # 公開ページ（プライバシー、利用規約）
│   └── api/                # API ルート
├── lib/                    # ビジネスロジック（Next.js 非依存）
│   ├── llm/                # LLM クライアント抽象化
│   ├── rag/                # RAG パイプライン（Embedding + 検索）
│   ├── feed/               # ニュース取得・ダイジェスト
│   ├── compass/            # 羅針盤エンジン
│   ├── decision/           # タスク判定ロジック
│   ├── compare/            # 比較エンジン
│   ├── billing/            # プラン・利用量管理
│   ├── stripe/             # Stripe 連携
│   └── ...
config/                     # 設定ファイル（features.json 等）
prompts/                    # LLM プロンプトテンプレート（外部ファイル管理）
prisma/                     # データベーススキーマ
```

### 設計原則

- **羅針盤中心設計** — 全ての判定機能（タスク判定・比較判定・週次レビュー）が同じ羅針盤コンテキストを共有
- **依存性逆転** — すべての依存はインターフェース経由
- **フレームワーク非依存** — `src/lib/` のビジネスロジックは Next.js に依存しない
- **薄いコントローラー** — API ルートはビジネスロジックの薄いラッパー
- **プロンプト外部管理** — LLM プロンプトは `prompts/` にファイルとして管理（ハードコード禁止）
- **設定外部管理** — マジックナンバーは `config/features.json` に集約

## セットアップ

### 前提条件

- Node.js 20+
- PostgreSQL（または [Supabase](https://supabase.com/) アカウント）

### 必要なアカウント

| サービス | 用途 | 必須 | 無料枠 |
|---------|------|:----:|--------|
| [Clerk](https://clerk.com) | ユーザー認証 | **必須** | 10,000 MAU |
| [Supabase](https://supabase.com) | PostgreSQL データベース | **必須** | 500MB / 2プロジェクト |
| [OpenAI](https://platform.openai.com) | LLM + Embedding + Vision | **必須** | なし（従量課金） |
| [Vercel](https://vercel.com) | ホスティング | **必須** | Hobby プラン無料 |
| [Stripe](https://stripe.com) | Pro プラン課金 | 任意 | 決済手数料のみ |
| [Google AI](https://aistudio.google.com) | Gemini モデル | 任意 | 無料枠あり |
| [Anthropic](https://console.anthropic.com) | Claude モデル | 任意 | なし（従量課金） |
| [Resend](https://resend.com) | メールダイジェスト | 任意 | 3,000通/月 |

### アカウント作成手順

#### 1. Clerk（認証）

1. https://clerk.com でアカウント作成
2. ダッシュボードで **「Create application」**
3. 認証方法を選択（Email、Google、GitHub など）
4. **API Keys** ページから取得:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_test_...)
   - `CLERK_SECRET_KEY` (sk_test_...)

#### 2. Supabase（データベース）

1. https://supabase.com でアカウント作成
2. **「New Project」** で新規プロジェクト作成（Region: Tokyo 推奨）
3. **Settings > Database > Connection string** から取得:

| 用途 | ポート | 環境変数 |
|------|:------:|---------|
| アプリ接続 | 6543 | `DATABASE_URL` |
| マイグレーション | 5432 | `DIRECT_URL` |

#### 3. OpenAI（LLM）

1. https://platform.openai.com でアカウント作成
2. **API Keys** で新しいキーを作成
3. **Billing** でクレジットを追加（$5〜で十分）
4. 取得: `OPENAI_API_KEY` (sk-...)

#### 4. Stripe（課金）— 任意

1. https://stripe.com でアカウント作成
2. テストモードで **Products** に Pro プランを作成
3. 取得: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRO_PRICE_ID`
4. Webhook 設定:
   ```bash
   # ローカル開発時
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

#### 5. Google AI / Anthropic（任意）

- Google AI: https://aistudio.google.com → **「Get API key」**
- Anthropic: https://console.anthropic.com → **API Keys**

### インストール手順

```bash
# 1. リポジトリのクローン
git clone <repository-url>
cd aisupport

# 2. 依存パッケージのインストール
npm install

# 3. 環境変数ファイルの作成
cp .env.local.example .env.local
# → .env.local を編集して各キーを設定

# 4. 暗号化キーの生成（BYOK用）
openssl rand -hex 32
# → 出力を API_KEY_ENCRYPTION_KEY に設定

# 5. VAPID キーの生成（Web Push用）
node scripts/generate-vapid-keys.js
# → 出力を .env.local に設定

# 6. データベースセットアップ
npx prisma db push

# 7. 開発サーバー起動
npm run dev
```

http://localhost:3000 でアクセスできます。

### 環境変数一覧

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 接続文字列（プール経由、ポート 6543） |
| `DIRECT_URL` | PostgreSQL 直接接続（ポート 5432） |
| `OPENAI_API_KEY` | OpenAI API キー |
| `GOOGLE_AI_API_KEY` | Google AI API キー（任意） |
| `ANTHROPIC_API_KEY` | Anthropic API キー（任意） |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公開キー |
| `CLERK_SECRET_KEY` | Clerk シークレットキー |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名シークレット |
| `STRIPE_PRO_PRICE_ID` | Stripe Pro プラン価格 ID |
| `NEXT_PUBLIC_APP_URL` | アプリケーション URL |
| `API_KEY_ENCRYPTION_KEY` | BYOK 暗号化キー（64桁 hex） |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID 公開キー |
| `VAPID_PRIVATE_KEY` | VAPID 秘密キー |
| `VAPID_EMAIL` | VAPID 連絡先メール |
| `RESEND_API_KEY` | Resend API キー |
| `DIGEST_FROM_EMAIL` | ダイジェスト送信元メール |

詳細は `.env.local.example` を参照してください。

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー起動 |
| `npm test` | ユニットテスト実行（Vitest） |
| `npm run test:watch` | テストウォッチモード |
| `npm run dev:e2e` | E2E テスト用開発サーバー |
| `npm run test:e2e` | E2E テスト実行（Playwright） |
| `npm run lint` | ESLint 実行 |
| `npm run db:push` | Prisma スキーマをデータベースに反映 |

## Cron ジョブ

`vercel.json` で設定済み:

| スケジュール | エンドポイント | 説明 |
|-------------|--------------|------|
| 毎日 6:00 UTC | `/api/feed/cron` | ニュース記事の取得 |
| 毎日 0:00 UTC | `/api/feed/digest-cron` | メールダイジェスト配信 |

## Vercel デプロイ

### 手順

1. [Vercel](https://vercel.com) でリポジトリをインポート
2. **Settings > Environment Variables** で全環境変数を設定
3. デプロイ — 以降は `git push` で自動デプロイ
4. Stripe Webhook エンドポイントを設定: `https://your-domain.vercel.app/api/stripe/webhook`
   - イベント: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Clerk を本番インスタンスに切り替え、本番用キー（`pk_live_` / `sk_live_`）を設定

### 費用の目安（個人利用）

| サービス | 月額目安 |
|---------|---------|
| Vercel (Hobby) | 無料 |
| Clerk | 無料（10,000 MAU 以内） |
| Supabase | 無料（500MB 以内） |
| OpenAI | $1〜5 |
| **合計** | **約 $1〜5 / 月** |

## ライセンス

Private
