# Logger 設計書 — クリーンアーキテクチャ対応ログ基盤

## 目的

- デバッグ効率化: 「なぜ null？」が Vercel ログで即座に分かるようにする
- クリーンアーキテクチャ: ビジネスロジックが `console` に直接依存しない
- テスト容易性: Logger をモック注入してログ出力を検証可能にする

## 設計方針

### Logger インターフェース + DI

```typescript
// src/lib/logger/types.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(name: string): Logger;
}
```

### ConsoleLogger 実装

```typescript
// src/lib/logger/console-logger.ts
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class ConsoleLogger implements Logger {
  constructor(private readonly name: string, private readonly minLevel: LogLevel) {}

  child(childName: string): Logger {
    return new ConsoleLogger(`${this.name}:${childName}`, this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  debug(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("debug")) console.log(`[${this.name}] DEBUG:`, msg, ctx ?? "");
  }
  info(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("info")) console.info(`[${this.name}] INFO:`, msg, ctx ?? "");
  }
  warn(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("warn")) console.warn(`[${this.name}] WARN:`, msg, ctx ?? "");
  }
  error(msg: string, ctx?: Record<string, unknown>) {
    if (this.shouldLog("error")) console.error(`[${this.name}] ERROR:`, msg, ctx ?? "");
  }
}
```

### ファクトリ

```typescript
// src/lib/logger/index.ts
import { ConsoleLogger } from "./console-logger";
import type { Logger, LogLevel } from "./types";

const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info") as LogLevel;

export function createLogger(name: string): Logger {
  return new ConsoleLogger(name, LOG_LEVEL);
}

export type { Logger, LogLevel } from "./types";
```

## レイヤー別適用ルール

| レイヤー | ログの扱い |
|---------|-----------|
| API Route | `createLogger()` で生成し、`logger.child()` でビジネスロジックに渡す |
| ビジネスロジック | コンストラクタで `Logger` を受け取る（DI） |
| インフラ層 | 基本ログなし。エラーは throw して上位に任せる |
| コンポーネント | `console.warn` のまま（クライアント側はスコープ外） |

## ログ出力例

```
[api:compass-suggest] INFO: リクエスト受信 { userId: "user_39p..." }
[api:compass-suggest:suggester] INFO: 放置アイテムなし
[api:compass-suggest] INFO: レスポンス返却 { hasSuggestion: false }
```

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `LOG_LEVEL` | `info` | debug / info / warn / error |

- 開発中: `LOG_LEVEL=debug`
- 本番: `LOG_LEVEL=info`（デフォルト）
- ログ削減時: `LOG_LEVEL=warn`

## 段階的適用

### Phase 1（今回）: Compass 系 + Logger 基盤
- Logger インターフェース・実装・ファクトリ作成
- CompassSuggester, NeglectDetector に Logger DI 追加
- POST /api/compass/suggest に Logger 生成・注入
- テスト更新（Logger モック追加）

### Phase 2（将来）: 主要 API に展開
- TaskDecisionEngine に Logger DI 追加
- POST /api/decide, /api/breakdown に Logger 注入
- key-resolver 等のユーティリティにも適用
