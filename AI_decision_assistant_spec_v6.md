# AI意思決定アシスタント 要件定義書 v6

作成日: 2026-02-11
更新日: 2026-02-11

------------------------------------------------------------------------

## 1. 目的

時間と場所の自由を維持しながら年収1,000万円を安定維持するための
「冷静ロジカル型 意思決定AIアシスタント」を構築する。

本アシスタントの役割は、決断疲れの軽減、優先順位の明確化、毎日の小さな前進の支援である。

------------------------------------------------------------------------

## 2. コンセプト

- 感情的励ましは不要
- 構造と論理で判断
- 選択肢を削る
- 完璧より前進

------------------------------------------------------------------------

## 3. MVP（2月版）機能要件

### 3.1 今日の最適タスク決定機能（最重要）

入力:
- タスク候補一覧
- 利用可能時間
- エネルギー状態（1-5）
- 使用エンジン選択（OpenAI / Gemini）※MVP対象エンジン

出力:
1. 今日の最適タスク
2. 選定理由（最大3行）
3. 最初の5分行動

**不安モード（低エネルギー時の自動拡張）:**
エネルギー状態が閾値以下の場合、同一画面内でプロンプトを自動切替し、以下を追加出力する。
- 状態の構造分析（なぜ動けないかの言語化）
- 5分行動の提示（通常より負荷を下げた選択肢）
- 選択肢を最大2つに削減

※ 不安モードは独立画面・独立機能としない。タスク決定機能のプロンプトバリエーションとして統合する。
※ 閾値はデフォルト2。`config/features.json` で変更可能にする（マジックナンバー排除）。

**入力バリデーション（Fail Fast）:**
不正な入力は即座にエラーを返し、LLM APIを呼ばない。

| 入力項目 | バリデーション | エラー時の動作 |
|---|---|---|
| タスク候補一覧 | 1件以上必須・各タスク1文字以上 | 「タスクを1つ以上入力してください」表示 |
| 利用可能時間 | 1分以上・1440分以下の整数 | 「利用可能時間を正しく入力してください」表示 |
| エネルギー状態 | 1-5の整数 | 「1〜5の範囲で選択してください」表示 |
| エンジン選択 | 有効なプロバイダー名 | 「エンジンを選択してください」表示 |

バリデーションは `src/lib/validation/` に集約し、API RouteとUI側の両方で再利用する。

------------------------------------------------------------------------

### 3.2 タスク分解機能

- 大きなタスクを15分単位に分解
- 今日実行すべき最小単位を提示

※ タスク決定機能の出力から「分解が必要」と判断された場合に呼び出す補助機能として位置づける。

------------------------------------------------------------------------

### 3.3 コスト可視化（最小版：当月の現在コスト表示）

**目的:**
- 「いまどれくらいコストがかかっているか」を即座に把握する
- 予算オーバーを防ぐ（※アラートは将来拡張）

**表示項目（2月の最小版）:**
- 当月合計コスト（円/ドル）
- エンジン別コスト内訳（OpenAI / Gemini）※MVP対象分
- モデル別コスト内訳（例：gpt-4o-mini / gemini-2.0-flash など）
- 直近7日の日別推移（簡易でOK）

**実装方針:**
- アプリ側で利用ログを必ず記録し、自前で集計する
  - 記録項目: provider, model, input_tokens, output_tokens, total_tokens, request_id, timestamp, feature（decide等）
- 料金単価（トークン単価）は設定ファイルで管理し、後から更新可能にする（→ セクション5.1参照）
- 公式請求額との差異は許容（傾向把握を主目的）

**トークン計測方針（プロバイダー別）:**
各社APIのトークン数取得方法が異なるため、`TokenCounter`層で差異を吸収する。
- **OpenAI**: `tiktoken` によるローカル事前計測が可能。ストリーミング時は `stream_options: { include_usage: true }` を指定し、最終チャンクの `usage` フィールドから取得
- **Gemini**: レスポンスの `usageMetadata`（`promptTokenCount`, `candidatesTokenCount`）から取得
- **Claude**（Phase2）: レスポンスの `usage` フィールド（`input_tokens`, `output_tokens`）から取得。ストリーミング時は `message_delta` イベントの `usage` から取得

**備考:**
- 正確な請求額の取得（各社のBilling/Usage API参照）や、予算アラート/通知は Phase2 以降で追加

------------------------------------------------------------------------

## 4. AIエンジン戦略

### 4.1 エンジン導入優先順位

コスト効率・開発効率・予算制約を考慮し、以下の順序でエンジンを導入する。

| 優先度 | エンジン | モデル | 導入時期 | 用途・理由 |
|---|---|---|---|---|
| 1st | OpenAI | gpt-4o-mini | Phase1（2月・最初に実装） | API成熟度が最高。tiktokenによるローカルトークン計測が可能で、コスト可視化の検証に最適。月数十円レベルの低コスト |
| 2nd | Google Gemini | gemini-2.0-flash | Phase1（OpenAI安定後） | 無料枠が大きく、有料でも非常に安価。日常利用の低コストエンジンとして運用 |
| 3rd | Anthropic Claude | claude-sonnet | Phase2 | 推論品質が高く、判断基準ロジックの精度向上に有効。Phase2の高品質判断モード用 |

**運用想定:**
- 普段使い → Gemini 2.0 Flash（最低コスト）
- 標準利用 → OpenAI gpt-4o-mini（バランス型）
- 重要な判断 → Claude Sonnet（Phase2、高品質）

### 4.2 補助ツール（API統合対象外）

| ツール | 用途 | 備考 |
|---|---|---|
| NotebookLM | 価値観マップ・戦略資料の整理、壁打ち | 公開APIなし。手動で利用し、整理結果を `prompts/shared/evaluation-axes.md` 等に反映する |
| Claude Code | 本アプリ自体の開発 | 開発ツールとして使用。プロダクトのAPIとは別 |

### 4.3 MVP対象エンジンの選定理由

MVPでは **OpenAI + Gemini** の2エンジンに絞る。

**Claude APIをMVPから除外する理由:**
- 開発ツールとしてClaude Codeを使用しており、プロダクト内でもClaude APIを呼ぶと役割が混在しやすい
- Sonnetの品質は高いがトークン単価も高く、MVP段階のテスト・試行に不向き
- Phase2で「高品質判断モード」として明確な差別化ポイントを持たせて導入する方が効果的

------------------------------------------------------------------------

## 5. 技術構成

### 5.1 料金・コスト管理（MVP）

- 単価はコードに埋め込まず、設定ファイルとして管理する
  - provider/model ごとの単価テーブル（入力・出力トークン単価）
  - 通貨（USD/JPY）と換算レート（手動更新でOK）
- MVPは「ログ集計×単価テーブル」で月額コストを算出する

**単価設定ファイル例（`config/pricing.json`）:**
```json
{
  "currency": "USD",
  "exchange_rate_jpy": 150,
  "providers": {
    "openai": {
      "gpt-4o-mini": { "input_per_1m": 0.15, "output_per_1m": 0.60 },
      "gpt-4o": { "input_per_1m": 2.50, "output_per_1m": 10.00 }
    },
    "gemini": {
      "gemini-2.0-flash": { "input_per_1m": 0.10, "output_per_1m": 0.40 },
      "gemini-2.0-pro": { "input_per_1m": 1.25, "output_per_1m": 5.00 }
    },
    "claude": {
      "claude-sonnet-4-20250514": { "input_per_1m": 3.00, "output_per_1m": 15.00 }
    }
  }
}
```

※ 単価は per 1M tokens で統一。Claude分はPhase2導入時にアクティブ化。

**機能フラグ設定（`config/features.json`）:**
```json
{
  "anxiety_mode_threshold": 2,
  "default_timeout_ms": 30000,
  "max_retry_count": 3,
  "enabled_providers": ["openai", "gemini"],
  "default_provider": "openai",
  "default_model": {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-2.0-flash"
  }
}
```

※ マジックナンバーや挙動の分岐条件は全てこの設定ファイルに集約する。

------------------------------------------------------------------------

### 5.2 フロントエンド

- Next.js（TypeScript）
- レスポンシブ対応
- PWA対応予定

**画面構成（MVP）:**
1. **タスク決定画面**: タスク入力 → エンジン選択 → 結果表示（不安モード含む）
2. **コストダッシュボード**: 当月コスト・内訳・推移

**ストリーミングUI状態管理:**
LLMのストリーミングレスポンスに対応するため、以下の状態遷移を管理する。

```
idle → loading → streaming → completed
                           → error
```

| 状態 | UI表示 | 操作 |
|---|---|---|
| idle | 入力フォーム表示 | 送信可能 |
| loading | スピナー表示 | 送信不可・キャンセル可能 |
| streaming | テキスト逐次表示 | 送信不可・中断可能 |
| completed | 結果表示 | 再送信可能 |
| error | エラーメッセージ + リトライボタン | リトライ or エンジン切替 |

状態管理には `useReducer` を使用し、状態遷移を明示的に定義する。

------------------------------------------------------------------------

### 5.3 バックエンド

- Next.js API Route（薄いコントローラーとして使用）
- ビジネスロジックは `src/lib/` 以下に分離して配置
- API Routeはリクエスト検証とレスポンス整形のみ担当
- 将来のサーバー分離（Node.jsスタンドアロン等）に備え、`src/lib/` 内のモジュールがNext.js固有のAPIに依存しないようにする

------------------------------------------------------------------------

### 5.4 LLM抽象化設計

各社APIの差異を吸収するため、以下の3層に分離する。
全てのビジネスロジックは抽象（インターフェース）に依存し、具象実装には依存しない（依存性逆転の原則）。

**1. LLMClient（API通信層）**
- 各プロバイダーのAPI認証・リクエスト送信・レスポンスパース
- ストリーミング対応
- インターフェース: `LLMClient`（`src/lib/llm/types.ts` に定義）
- MVP実装: `OpenAIClient`, `GeminiClient`
- Phase2追加: `ClaudeClient`

```typescript
// src/lib/llm/types.ts — 全てこのインターフェースに依存する
interface LLMClient {
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  extractUsage(rawResponse: unknown): TokenUsage;
}

interface LLMRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  content: string;
  usage: TokenUsage;
  requestId?: string;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

**依存の方向:**
```
Decision Engine → LLMClient (interface)
                      ↑ implements
              OpenAIClient / GeminiClient / ClaudeClient
```
Decision Engine は `LLMClient` インターフェースのみを知る。どの具象クラスが使われるかは、ファクトリ（`createLLMClient(provider)`）で解決する。新しいプロバイダーの追加時にDecision Engineの変更は不要。

**2. PromptBuilder（プロンプト構築層）**
- 各エンジンのメッセージ形式差を吸収（system/user/assistantの扱い等）
- プロンプトテンプレートの読み込み・変数埋め込み
- テンプレートは `prompts/` ディレクトリに外部ファイルとして管理（ハードコード禁止）

**3. TokenCounter（トークン計測層） ※計測のみ**
- 各社のトークン数取得方法の差異を吸収
- 計測結果を `TokenUsage` として返却する
- **ログ記録は担当しない**（単一責任。ログ記録は `UsageLogRepository` の責務）
- OpenAI: `tiktoken` によるローカル計測 + APIレスポンスの `usage`
- Gemini: APIレスポンスの `usageMetadata`
- Claude（Phase2）: APIレスポンスの `usage` フィールド

**エンジン切替:** ファクトリ関数 `createLLMClient(provider)` で実装を差し替え
**並列実行:** 複数の `LLMClient` を同時呼び出しすることで実現（Phase2以降）

**共通エラーハンドリング（LLMClientWrapper）:**
各プロバイダー固有のエラーを共通エラー型に変換し、リトライロジックを一箇所に集約する。

```typescript
// src/lib/llm/client-wrapper.ts
// 全LLMClient呼び出しをラップし、リトライ・タイムアウト・エラー変換を担当
class LLMClientWrapper implements LLMClient {
  constructor(
    private client: LLMClient,
    private config: RetryConfig
  ) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    return withRetry(() => this.client.chat(request), this.config);
    // OpenAIの429もGeminiの429も、ここで統一的にリトライされる
  }
}
```

これにより、各 `OpenAIClient` / `GeminiClient` の実装はAPI通信だけに集中でき、リトライ・タイムアウトの重複実装を排除する。

------------------------------------------------------------------------

### 5.5 プロンプト管理

プロンプトテンプレートは外部ファイルで管理し、コードへのハードコードを禁止する。

**ディレクトリ構成:**
```
prompts/
├── task-decision/
│   ├── system.md          # システムプロンプト（判断基準ロジック含む）
│   ├── user-template.md   # ユーザー入力テンプレート
│   └── anxiety-mode.md    # 不安モード用の追加指示
├── task-breakdown/
│   └── system.md
└── shared/
    └── evaluation-axes.md # 評価軸定義（セクション8の内容）
```

**テンプレート変数:**
- `{{tasks}}` - タスク候補一覧
- `{{available_time}}` - 利用可能時間
- `{{energy_level}}` - エネルギー状態（1-5）
- `{{evaluation_axes}}` - 評価軸（shared/から読み込み）

**プロンプトバージョン管理:**
- テンプレートファイルはGitで管理し、変更履歴を追跡する
- MVPでは単一バージョン運用。Phase2でA/Bテスト機能を追加
  - A/Bテスト時は `prompts/task-decision/v2/` のようにディレクトリで分離
  - どのバージョンを使用したかを `llm_usage_logs` の `metadata` カラムに記録

**NotebookLMとの連携運用:**
- 価値観マップや戦略資料をNotebookLMに投入して壁打ち・整理
- 整理結果を `prompts/shared/evaluation-axes.md` に手動反映
- プロンプトの評価軸チューニングの補助ツールとして随時活用

------------------------------------------------------------------------

### 5.6 データ永続化（MVP）

MVPではコストログの記録が必須のため、Phase1から最小限のDB設計を含める。

**技術選定:**
- SQLite（ローカル開発・単一ユーザー前提で十分）
- ORMは Prisma を使用（将来のDB移行に備える）

**Repository パターン:**
DB操作は全て Repository インターフェース経由で行い、Prisma等の具象ORMに直接依存しない。

```typescript
// src/lib/db/types.ts — Repository インターフェース
interface UsageLogRepository {
  save(log: UsageLogEntry): Promise<void>;
  findByMonth(year: number, month: number): Promise<UsageLogEntry[]>;
  findByDateRange(from: Date, to: Date): Promise<UsageLogEntry[]>;
  aggregateByProvider(year: number, month: number): Promise<ProviderCostSummary[]>;
}

// src/lib/db/prisma-usage-log-repository.ts — 具象実装
class PrismaUsageLogRepository implements UsageLogRepository {
  // Prisma固有のコードはここだけに閉じ込める
}
```

将来SQLiteからPostgreSQL/Supabaseに移行する場合、新しいRepository実装を追加するだけで済む。

**テーブル設計（MVP）:**

```
llm_usage_logs:
  id              INTEGER PRIMARY KEY
  provider        TEXT NOT NULL        -- "openai" / "gemini"（Phase2で "claude" 追加）
  model           TEXT NOT NULL        -- "gpt-4o-mini" / "gemini-2.0-flash" 等
  input_tokens    INTEGER NOT NULL
  output_tokens   INTEGER NOT NULL
  total_tokens    INTEGER NOT NULL
  feature         TEXT NOT NULL        -- "task_decision" / "task_breakdown"
  request_id      TEXT
  metadata        TEXT                 -- JSON。プロンプトバージョン等の追加情報（Phase2で活用）
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
```

**将来拡張用（Phase2で追加）:**
```
task_decisions:
  id              INTEGER PRIMARY KEY
  tasks_input     TEXT                -- 入力タスク一覧（JSON）
  energy_level    INTEGER
  available_time  INTEGER
  provider        TEXT
  result          TEXT                -- 決定結果（JSON）
  created_at      DATETIME
```

------------------------------------------------------------------------

### 5.7 認証・APIキー管理

**MVP（単一ユーザー前提）:**
- 各社APIキーは `.env.local` で管理
- アプリ自体の認証は不要（ローカル or Vercel等のプライベートデプロイ前提）

```env
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
# Phase2で追加
# ANTHROPIC_API_KEY=sk-ant-...
```

**将来拡張（マルチユーザー対応時）:**
- ユーザーが自身のAPIキーを登録する画面を追加
- キーは暗号化してDBに保存
- Supabase Auth等の認証基盤を導入

------------------------------------------------------------------------

### 5.8 エラーハンドリング方針

**共通エラー型:**
全てのLLMプロバイダーのエラーを以下の共通型に変換し、UI側で統一的に扱う。

```typescript
// src/lib/llm/errors.ts
type LLMErrorCode =
  | "RATE_LIMITED"       // 429
  | "AUTH_FAILED"        // 401/403
  | "TIMEOUT"            // タイムアウト
  | "SERVER_ERROR"       // 500系
  | "NETWORK_ERROR"      // 接続不可
  | "INVALID_RESPONSE"   // レスポンスパース失敗
  | "UNKNOWN";

class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    public provider: string,
    public retryable: boolean,
    message: string
  ) { super(message); }
}
```

**エラー種別ごとの対応:**

| エラー種別 | LLMErrorCode | リトライ | 対応方針 |
|---|---|---|---|
| レート制限（429） | RATE_LIMITED | 最大3回（指数バックオフ） | LLMClientWrapperで自動リトライ |
| タイムアウト | TIMEOUT | しない | 即座にエラー表示 |
| 認証エラー（401/403） | AUTH_FAILED | しない | APIキー設定の確認を促す |
| サーバーエラー（500系） | SERVER_ERROR | 最大2回 | LLMClientWrapperで自動リトライ |
| ネットワークエラー | NETWORK_ERROR | しない | オフライン状態の通知 |
| レスポンス異常 | INVALID_RESPONSE | しない | エラー表示 + ログ記録 |

**フォールバック方針（MVP）:**
- MVPではエンジン間の自動フォールバックは実装しない（意図しないコスト発生を防ぐため）
- ユーザーに「このエンジンでエラーが発生しました。別のエンジンに切り替えますか？」と確認UI表示
- 自動フォールバックはPhase2で設定可能なオプションとして追加

------------------------------------------------------------------------

### 5.9 テスト戦略

**MVP段階で最低限必要なテスト方針:**

LLM APIを使ったアプリはテストが難しい。以下の方針でテスト可能な設計を維持する。

**1. LLMClientのモック戦略:**
`LLMClient` インターフェースに依存しているため、テスト時はモック実装を注入する。

```typescript
// src/lib/llm/mock-client.ts（テスト用）
class MockLLMClient implements LLMClient {
  constructor(private fixedResponse: string) {}
  async chat(request: LLMRequest): Promise<LLMResponse> {
    return {
      content: this.fixedResponse,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
  }
}
```

**2. テストレベル別方針:**

| レベル | 対象 | 方針 | MVP対応 |
|---|---|---|---|
| ユニットテスト | バリデーション、コスト計算、プロンプト構築 | LLM不要。純粋関数としてテスト | ○ 必須 |
| 統合テスト | Decision Engine全体 | MockLLMClientを注入してE2E的に検証 | ○ 必須 |
| APIテスト | 各LLMClient実装 | 実APIを叩くスモークテスト。CIでは手動実行 | △ 任意 |
| E2Eテスト | UI操作 | Playwright等。Phase2以降 | × 不要 |

**3. テストファイル配置:**
```
__tests__/
├── lib/
│   ├── llm/
│   │   ├── prompt-builder.test.ts
│   │   └── client-wrapper.test.ts
│   ├── decision/
│   │   └── task-decision-engine.test.ts
│   ├── cost/
│   │   └── calculator.test.ts
│   └── validation/
│       └── task-input.test.ts
└── integration/
    └── decision-flow.test.ts    # MockLLMClient使用
```

**テストフレームワーク:** Vitest（Next.jsとの相性が良く、高速）

------------------------------------------------------------------------

## 6. 開発環境：Claude Code プラグイン・MCP戦略

本プロジェクトの開発にはClaude Codeを使用する。
開発効率と品質を最大化するため、以下のプラグイン・MCPサーバーを導入順序に従ってセットアップする。

### 6.1 導入計画

| 導入タイミング | ツール | 種別 | 効果 |
|---|---|---|---|
| 開発開始時（最初に導入） | Context7 | MCP | ライブラリの最新APIドキュメントを自動参照。古いコード生成を防止 |
| 開発開始時（最初に導入） | Superpowers | プラグイン | 計画→テスト→実装の品質ワークフローを強制 |
| 初回Git push後 | GitHub MCP | MCP | Issue/PR管理をClaude Codeから直接操作 |
| 2-3セッション後 | claude-mem | プラグイン | セッション間の作業文脈を自動引き継ぎ |
| Phase2 | Playwright MCP | MCP | E2Eテスト自動化 |

### 6.2 各ツール詳細

**Context7（最新ドキュメント参照）— 必須**

LLMの学習データには最新のライブラリ情報が含まれないため、古いAPIや非推奨の記法でコードを生成するリスクがある。Context7はライブラリの最新ドキュメントをリアルタイムで取得し、Claude Codeのプロンプトに反映する。

本プロジェクトでは Next.js App Router、Prisma、OpenAI SDK、Google AI SDK と複数のライブラリを使用するため、特に重要。

```bash
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp
```

**Superpowers（計画→テスト→実装ワークフロー）— 必須**

ソフトウェア開発のワークフローをClaude Codeに組み込むプラグイン。計画→テスト→実装の順番を強制することで、「とりあえずコードを書く→不完全→手戻り」を防止する。サブエージェントによる並列実行も可能。

本プロジェクトのセクション5.9で定義したテスト戦略（テスト先行）との相性が良い。

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

**使い方:**
```bash
# ワークフロー有効化
/using-superpowers

# 要件定義書に基づいた計画を立てる
/superpowers:write-plan

# 計画を実行（サブエージェントが並列で動く）
/superpowers:execute-plan
```

**GitHub MCP（Git操作の自動化）— 強く推奨**

Claude CodeからGitHub操作（Issue作成・PR管理・コミット分析）を直接実行できる。一人開発でもブランチ管理・コミット履歴の参照が効率化される。

```bash
claude mcp add github -s user -- npx -y @modelcontextprotocol/server-github
```

**claude-mem（セッション間メモリ）— 強く推奨**

セッション中のツール使用をすべて自動キャプチャし、AI圧縮でセマンティックな要約を生成。次回セッション開始時に関連コンテキストを自動で差し込む。CLAUDE.mdへの手動記述を補完する。

```bash
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

**Playwright MCP（E2Eテスト）— Phase2**

ブラウザ操作やテストをClaude Codeから自動化する。Phase2でE2Eテストを導入する際にセットアップする。

```bash
claude mcp add playwright -s project -- npx -y @playwright/mcp@latest
```

### 6.3 CLAUDE.md の構成方針

プロジェクトルートの `CLAUDE.md` に要件定義書の要約と開発ルールを記載し、Claude Codeが毎セッション自動で読み込めるようにする。

```markdown
# CLAUDE.md

## プロジェクト概要
AI意思決定アシスタント MVP。詳細は AI_decision_assistant_spec_v6.md を参照。

## 技術スタック
- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Vitest
- OpenAI SDK (gpt-4o-mini) + Google AI SDK (gemini-2.0-flash)

## 設計原則
- 全てインターフェース経由で依存（依存性逆転）
- ビジネスロジックは src/lib/ に集約（Next.js非依存）
- API Routeは薄いコントローラー
- マジックナンバーは config/features.json に集約
- プロンプトは prompts/ に外部ファイル管理（ハードコード禁止）

## テスト方針
- Vitest使用
- LLMClient はモック注入でテスト
- バリデーション・コスト計算は純粋関数テスト

## 参照ドキュメント
- 要件定義書: AI_decision_assistant_spec_v6.md
- 型定義: src/lib/llm/types.ts
- エラー型: src/lib/llm/errors.ts
```

### 6.4 Claude Codeセッション運用ルール

**1セッション = 1タスクの原則:**
- 1回の指示で1〜3ファイルを対象にする
- 要件定義書のセクション番号を明示する（例：「セクション5.4に従って」）
- 実装前にテストを書かせる（Superpowersのワークフローに従う）

**指示のテンプレート:**
```
[対象セクション] セクションX.X に従って [タスク内容] を実装して。
[対象ファイル] 以下のファイルが対象:
  - src/lib/xxx/yyy.ts
  - __tests__/lib/xxx/yyy.test.ts
[前提] 既に実装済みの src/lib/llm/types.ts のインターフェースに従うこと。
```

------------------------------------------------------------------------

## 7. アーキテクチャ概要

```
UI（Next.js / useReducer で状態管理）
  ↓
API Route（薄いコントローラー）
  ├── 入力バリデーション（src/lib/validation/）
  ↓
┌─────────────────────────────────────────────────┐
│  src/lib/（ビジネスロジック層）                    │
│  ※ 全て interface に依存。具象実装に依存しない     │
│                                                   │
│  TaskDecisionEngine                               │
│    ├── PromptBuilder（テンプレート読み込み）       │
│    ├── LLMClient (interface)                      │
│    │    └── LLMClientWrapper（リトライ・エラー変換）│
│    │         ├── OpenAIClient [MVP]               │
│    │         ├── GeminiClient [MVP]               │
│    │         └── ClaudeClient [Phase2]            │
│    └── TokenCounter（計測のみ。ログ記録しない）    │
│                                                   │
│  CostCalculator                                   │
│    ├── UsageLogRepository (interface)             │
│    │    └── PrismaUsageLogRepository              │
│    └── PricingConfig                              │
└─────────────────────────────────────────────────┘
  ↓
DB（SQLite / Prisma）
```

**依存ルール:**
- 内側（ドメインロジック）は外側（DB・API・フレームワーク）を知らない
- 全ての外部依存はインターフェース経由で注入する
- 新しいプロバイダーやDB追加時に既存コードの変更が不要

------------------------------------------------------------------------

## 8. ディレクトリ構成

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # タスク決定画面
│   ├── cost/
│   │   └── page.tsx              # コストダッシュボード
│   └── api/
│       ├── decide/route.ts       # タスク決定API
│       ├── breakdown/route.ts    # タスク分解API
│       └── cost/route.ts         # コスト取得API
├── lib/                          # ビジネスロジック（Next.js非依存）
│   ├── llm/
│   │   ├── types.ts              # LLMClient / LLMRequest / LLMResponse 型定義
│   │   ├── errors.ts             # LLMError 共通エラー型
│   │   ├── client-wrapper.ts     # リトライ・タイムアウト・エラー変換
│   │   ├── client-factory.ts     # createLLMClient(provider) ファクトリ
│   │   ├── openai-client.ts      # [MVP] 最初に実装
│   │   ├── gemini-client.ts      # [MVP] 2番目に実装
│   │   ├── claude-client.ts      # [Phase2]
│   │   ├── mock-client.ts        # テスト用モック
│   │   ├── prompt-builder.ts
│   │   └── token-counter.ts      # 計測のみ（ログ記録はRepositoryの責務）
│   ├── decision/
│   │   └── task-decision-engine.ts  # ← engine.ts から命名改善
│   ├── cost/
│   │   ├── calculator.ts         # コスト計算
│   │   └── pricing.ts            # 単価設定読み込み
│   ├── db/
│   │   ├── types.ts              # UsageLogRepository インターフェース
│   │   └── prisma-usage-log-repository.ts  # Prisma具象実装
│   └── validation/               # 入力バリデーション（API・UI共用）
│       └── task-input.ts
├── components/                   # UIコンポーネント
│   ├── TaskDecisionForm.tsx
│   ├── DecisionResult.tsx
│   └── CostDashboard.tsx
└── prompts/                      # プロンプトテンプレート（外部ファイル）
    ├── task-decision/
    │   ├── system.md
    │   ├── user-template.md
    │   └── anxiety-mode.md
    ├── task-breakdown/
    │   └── system.md
    └── shared/
        └── evaluation-axes.md    # ← NotebookLMでの整理結果を反映

config/
├── pricing.json                  # トークン単価設定（per 1M tokens統一）
├── features.json                 # 機能フラグ・閾値・デフォルト設定
└── models.json                   # 利用可能モデル一覧

prisma/
└── schema.prisma                 # DBスキーマ定義

__tests__/                        # テスト
├── lib/
│   ├── llm/
│   ├── decision/
│   ├── cost/
│   └── validation/
└── integration/

CLAUDE.md                         # Claude Code用プロジェクト設定
AI_decision_assistant_spec_v6.md  # 本要件定義書
```

------------------------------------------------------------------------

## 9. 判断基準ロジック

**評価軸（優先順位順）:**

1. 自由度向上 — 時間・場所の自由を増やすか
2. 将来収入インパクト — 年収1,000万円維持への貢献度
3. 長時間拘束回避 — 拘束時間を減らす方向か
4. 精神的負担軽減 — 精神的コストが低いか
5. ワクワク・成長 — モチベーションにつながるか

**LLMへの適用方法:**
- 上記評価軸は `prompts/shared/evaluation-axes.md` に定義
- NotebookLMで価値観・戦略資料を整理し、評価軸の内容を継続的にチューニング
- システムプロンプトに埋め込み、LLMに各タスクを5軸で評価させる
- MVPでは数値スコアリングはLLM側に委ね、アプリ側でのスコア計算は行わない
- Phase2で「LLMのスコア出力をパースしてアプリ側で加重計算」する方式を検討

------------------------------------------------------------------------

## 10. フェーズ計画

### Phase1（2月）— MVP

**開発環境セットアップ（最初に実施）:**
1. Claude Codeのインストール・設定
2. Context7 MCP + Superpowers プラグインの導入
3. CLAUDE.md の作成（セクション6.3参照）
4. GitHub リポジトリ作成 + GitHub MCP 導入

**実装スコープ:**
1. LLM抽象化層（LLMClient + PromptBuilder + TokenCounter + LLMClientWrapper）
2. DB設計・コストログ記録基盤（Repository パターン）
3. 入力バリデーション
4. タスク決定機能（不安モード統合済み）
5. コストダッシュボード
6. ユニットテスト + 統合テスト

**画面数:** 2画面（タスク決定 + コストダッシュボード）

**MVP対象エンジン:** OpenAI（gpt-4o-mini） + Gemini（gemini-2.0-flash）

**推奨実装順序（Claude Code + Superpowers で実行）:**
1. プロジェクト初期設定（Next.js + Prisma + SQLite + Vitest）
2. 型定義・インターフェース設計（`types.ts`, `errors.ts`, `db/types.ts`）
3. OpenAI gpt-4o-mini の LLMClient 実装 + LLMClientWrapper ← **最初のタスク**
4. UsageLogRepository実装 + トークンログ記録
5. 入力バリデーション + ユニットテスト
6. タスク決定機能（OpenAIのみで動作確認） ← コア価値
7. Gemini LLMClient の追加実装 + エンジン切替UI
8. コスト可視化ダッシュボード ← ログが溜まってから意味が出る
9. 統合テスト（MockLLMClient使用）
10. claude-mem プラグイン導入（セッション間メモリ安定化）

**Claude Codeへの最初の指示例:**
```
このプロジェクトはAI意思決定アシスタントのMVPです。
まず型定義とインターフェースを作り、次にOpenAI gpt-4o-miniを使った
LLMClient実装とリトライ付きラッパーを作ってください。
要件定義書: AI_decision_assistant_spec_v6.md
対象ファイル:
  - src/lib/llm/types.ts（LLMClient / LLMRequest / LLMResponse / TokenUsage）
  - src/lib/llm/errors.ts（LLMError / LLMErrorCode）
  - src/lib/llm/openai-client.ts
  - src/lib/llm/client-wrapper.ts（リトライ・タイムアウト・エラー変換）
  - src/lib/llm/client-factory.ts
  - src/lib/db/types.ts（UsageLogRepository インターフェース）
```

### Phase2（3-4月）

- Claude API（Sonnet）の追加 → 高品質判断モード
- 履歴保存・検索
- 週次戦略レビュー
- 並列AI比較表示（OpenAI vs Gemini vs Claude の出力比較）
- 予算アラート
- エンジン間自動フォールバック（オプション）
- プロンプトA/Bテスト機能
- E2Eテスト（Playwright MCP 導入）

### Phase3（5月以降）

- RAG連携（価値観マップ・戦略資料参照）
- アプリ化（PWA本格対応 / Capacitor）
- 通知機能
- マルチユーザー対応
- gpt-4o / Gemini Pro 等の上位モデル切替オプション

------------------------------------------------------------------------

## 11. 成功定義

**定量指標:**
- 毎日1回以上使用する
- 決断にかかる時間が体感で半減する
- 月間LLMコストが把握できている
- MVP段階の月間LLMコストが500円以下に収まる

**定性指標:**
- 逃避行動（YouTube等）が減少する
- 小さな前進が継続する
- 「次に何をすべきか」で迷う時間がなくなる

------------------------------------------------------------------------

## 付録A: 設計原則チェックリスト

本プロジェクトで遵守する設計原則の一覧。コードレビュー時の判断基準として使用する。

| 原則 | 出典 | 本プロジェクトでの適用 |
|---|---|---|
| 単一責任の原則 | 良いコード/悪いコード設計入門 | TokenCounterは計測のみ。ログ記録はRepository。LLMClientはAPI通信のみ。リトライはWrapper |
| 依存性逆転の原則 | Clean Architecture | Decision Engine → LLMClient (interface)。DB操作 → UsageLogRepository (interface) |
| Fail Fast | 達人プログラマー | 入力バリデーションでLLM API呼び出し前に不正値を弾く。認証エラーは即座にエラー表示 |
| 変更前提の設計 | 達人プログラマー | プロンプト外部ファイル化。単価設定ファイル化。機能フラグ化。新プロバイダー追加時の変更箇所最小化 |
| 名前に意味を持たせる | リーダブルコード | `engine.ts` → `task-decision-engine.ts`。共通エラー型に明確な名前（LLMErrorCode） |
| マジックナンバー排除 | リーダブルコード / 良いコード設計 | 不安モード閾値・タイムアウト・リトライ回数は全て `config/features.json` に集約 |
| DRY（繰り返さない） | 達人プログラマー | エラーハンドリングはLLMClientWrapperに一箇所集約。バリデーションはAPI・UI共用 |
| レイヤー分離 | Clean Architecture | UI → API Route → lib（ドメイン） → DB。各層は隣接層のみ知る |
| テスト容易性 | 達人プログラマー | インターフェース依存によりモック注入が容易。MockLLMClientでLLM無しテスト可能 |

------------------------------------------------------------------------

以上。
