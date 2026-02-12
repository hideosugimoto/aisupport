# Task Breakdown Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** タスク決定結果から選ばれたタスクを具体的なサブタスクに分解する機能を実装する（要件定義書 3.2）

**Architecture:** TaskDecisionEngine と同じパターンで TaskBreakdownEngine を実装。プロンプトテンプレートは `prompts/task-breakdown/` に配置。DecisionResult にボタンを追加し、同一画面内でインライン表示。SSE ストリーミング対応。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, LLMClient interface (依存性逆転)

---

### Task 1: タスク分解プロンプトテンプレート作成

**Files:**
- Modify: `prompts/task-breakdown/system.md` (スタブ → 本実装)
- Create: `prompts/task-breakdown/user-template.md`
- Create: `prompts/task-breakdown/anxiety-mode.md`

**Step 1: system.md を実装**

```markdown
あなたはタスク分解の専門家です。

## 役割
- 選定されたタスクを具体的・実行可能なサブタスクに分解する
- 各サブタスクは15分以内で完了できる粒度にする
- 依存関係を考慮して実行順序を提示する
- 曖昧さを排除し、すぐに着手できる形にする

## 出力フォーマット
以下の形式でマークダウン出力してください。

### タスク分解: [タスク名]

### サブタスク一覧
1. **[サブタスク名]**（目安: X分）
   - 具体的な作業内容

2. **[サブタスク名]**（目安: X分）
   - 具体的な作業内容

### 最初の一歩
[最初のサブタスクに対する、すぐ着手できる具体的アクション]

### 完了の目安
- 合計所要時間: X分
- 完了基準: [何をもって完了とするか]
```

**Step 2: user-template.md を作成**

```markdown
以下のタスクを具体的なサブタスクに分解してください。

## 対象タスク
{{task}}

## 利用可能時間
{{available_time}}分

## エネルギー状態
{{energy_level}} / 5
```

**Step 3: anxiety-mode.md を作成**

```markdown
## 追加指示（低エネルギーモード）

現在のエネルギー状態が低いため、以下の方針で分解してください：

1. **サブタスクの粒度をさらに小さく** — 各サブタスクは5〜10分以内で完了できる粒度にしてください
2. **最初のサブタスクを最小限に** — 「とりあえずこれだけやる」レベルの小ささにしてください
3. **サブタスク数を制限** — 最大5つまでに絞ってください
4. **心理的ハードルの低い順に** — 簡単なものから並べてください
```

**Step 4: Commit**

```bash
git add prompts/task-breakdown/system.md prompts/task-breakdown/user-template.md prompts/task-breakdown/anxiety-mode.md
git commit -m "feat: add task breakdown prompt templates"
```

---

### Task 2: buildTaskBreakdownMessages テスト作成

**Files:**
- Create: `__tests__/lib/llm/prompt-builder-breakdown.test.ts`

**Step 1: テストファイル作成**

```typescript
import { describe, it, expect } from "vitest";
import { buildTaskBreakdownMessages } from "@/lib/llm/prompt-builder";

describe("buildTaskBreakdownMessages", () => {
  it("should build system and user messages", () => {
    const messages = buildTaskBreakdownMessages({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("should include task in user prompt", () => {
    const messages = buildTaskBreakdownMessages({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages[1].content).toContain("確定申告の準備");
    expect(messages[1].content).toContain("60分");
  });

  it("should include breakdown instructions in system prompt", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 30,
      energyLevel: 4,
    });

    expect(messages[0].content).toContain("タスク分解の専門家");
    expect(messages[0].content).toContain("サブタスク");
  });

  it("should include anxiety mode when energy <= 2", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 30,
      energyLevel: 2,
    });

    expect(messages[0].content).toContain("低エネルギーモード");
    expect(messages[0].content).toContain("5〜10分");
  });

  it("should NOT include anxiety mode when energy = 3", () => {
    const messages = buildTaskBreakdownMessages({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(messages[0].content).not.toContain("低エネルギーモード");
  });
});
```

**Step 2: テストが失敗することを確認**

Run: `npx vitest run __tests__/lib/llm/prompt-builder-breakdown.test.ts`
Expected: FAIL with "buildTaskBreakdownMessages is not a function" or similar import error

**Step 3: Commit**

```bash
git add __tests__/lib/llm/prompt-builder-breakdown.test.ts
git commit -m "test: add buildTaskBreakdownMessages tests (red)"
```

---

### Task 3: buildTaskBreakdownMessages 実装

**Files:**
- Modify: `src/lib/llm/prompt-builder.ts`

**Step 1: TaskBreakdownInput 型と buildTaskBreakdownMessages を追加**

`prompt-builder.ts` の末尾に以下を追加:

```typescript
export interface TaskBreakdownInput {
  task: string;
  availableTime: number;
  energyLevel: number;
}

export function buildTaskBreakdownMessages(
  input: TaskBreakdownInput
): Message[] {
  const systemTemplate = loadTemplate("task-breakdown/system.md");
  const userTemplate = loadTemplate("task-breakdown/user-template.md");

  const isAnxietyMode =
    input.energyLevel <= featuresConfig.anxiety_mode_threshold;

  let systemPrompt = systemTemplate;

  if (isAnxietyMode) {
    const anxietyTemplate = loadTemplate("task-breakdown/anxiety-mode.md");
    systemPrompt += "\n\n" + anxietyTemplate;
  }

  const userPrompt = replaceVariables(userTemplate, {
    task: input.task,
    available_time: String(input.availableTime),
    energy_level: String(input.energyLevel),
  });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
```

**Step 2: テスト実行して全件パスを確認**

Run: `npx vitest run __tests__/lib/llm/prompt-builder-breakdown.test.ts`
Expected: PASS (5 tests)

**Step 3: 既存テストも壊していないことを確認**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/lib/llm/prompt-builder.ts
git commit -m "feat: implement buildTaskBreakdownMessages"
```

---

### Task 4: TaskBreakdownEngine テスト作成

**Files:**
- Create: `__tests__/lib/decision/task-breakdown-engine.test.ts`

**Step 1: テストファイル作成**

```typescript
import { describe, it, expect, vi } from "vitest";
import { TaskBreakdownEngine } from "@/lib/decision/task-breakdown-engine";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  TokenUsage,
} from "@/lib/llm/types";
import type { UsageLogRepository } from "@/lib/db/types";

function createMockLLMClient(content: string = "mock breakdown"): LLMClient {
  return {
    chat: vi.fn<(req: LLMRequest) => Promise<LLMResponse>>().mockResolvedValue({
      content,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      requestId: "req-123",
    }),
    chatStream: vi.fn<(req: LLMRequest) => AsyncIterable<LLMStreamChunk>>(),
    extractUsage: vi.fn<(raw: unknown) => TokenUsage>().mockReturnValue({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    }),
  };
}

function createMockRepository(): UsageLogRepository {
  return {
    save: vi.fn(),
    findByMonth: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([]),
    aggregateByProvider: vi.fn().mockResolvedValue([]),
  };
}

describe("TaskBreakdownEngine", () => {
  it("should call LLM and return breakdown result", async () => {
    const client = createMockLLMClient("### サブタスク一覧\n1. サブタスクA");
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    const result = await engine.breakdown({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(result.content).toContain("サブタスクA");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o-mini");
    expect(client.chat).toHaveBeenCalledTimes(1);
  });

  it("should save usage log with feature=task_breakdown", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai");

    await engine.breakdown({
      task: "タスクA",
      availableTime: 30,
      energyLevel: 4,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4o-mini",
        feature: "task_breakdown",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      })
    );
  });

  it("should use custom model when provided", async () => {
    const client = createMockLLMClient();
    const repo = createMockRepository();
    const engine = new TaskBreakdownEngine(client, repo, "openai", "gpt-4o");

    await engine.breakdown({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
    });

    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" })
    );
  });
});
```

**Step 2: テストが失敗することを確認**

Run: `npx vitest run __tests__/lib/decision/task-breakdown-engine.test.ts`
Expected: FAIL with import error (module not found)

**Step 3: Commit**

```bash
git add __tests__/lib/decision/task-breakdown-engine.test.ts
git commit -m "test: add TaskBreakdownEngine tests (red)"
```

---

### Task 5: TaskBreakdownEngine 実装

**Files:**
- Create: `src/lib/decision/task-breakdown-engine.ts`

**Step 1: エンジン実装**

```typescript
import type { LLMClient, LLMStreamChunk } from "../llm/types";
import type { UsageLogRepository } from "../db/types";
import {
  buildTaskBreakdownMessages,
  type TaskBreakdownInput,
} from "../llm/prompt-builder";
import featuresConfig from "../../../config/features.json";

export interface BreakdownResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export class TaskBreakdownEngine {
  constructor(
    private client: LLMClient,
    private repository: UsageLogRepository,
    private provider: string,
    private model?: string
  ) {}

  async breakdown(input: TaskBreakdownInput): Promise<BreakdownResult> {
    const messages = buildTaskBreakdownMessages(input);
    const model =
      this.model ??
      featuresConfig.default_model[
        this.provider as keyof typeof featuresConfig.default_model
      ];

    const response = await this.client.chat({ model, messages });

    await this.repository.save({
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      feature: "task_breakdown",
      requestId: response.requestId,
    });

    return {
      content: response.content,
      provider: this.provider,
      model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
    };
  }

  async *breakdownStream(
    input: TaskBreakdownInput
  ): AsyncIterable<LLMStreamChunk> {
    const messages = buildTaskBreakdownMessages(input);
    const model =
      this.model ??
      featuresConfig.default_model[
        this.provider as keyof typeof featuresConfig.default_model
      ];

    let lastUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let hasUsage = false;

    try {
      for await (const chunk of this.client.chatStream({ model, messages })) {
        if (chunk.usage) {
          lastUsage = chunk.usage;
          hasUsage = true;
        }
        yield chunk;
      }
    } finally {
      if (hasUsage) {
        await this.repository.save({
          provider: this.provider,
          model,
          inputTokens: lastUsage.inputTokens,
          outputTokens: lastUsage.outputTokens,
          totalTokens: lastUsage.totalTokens,
          feature: "task_breakdown",
        });
      }
    }
  }
}
```

**Step 2: テスト実行して全件パスを確認**

Run: `npx vitest run __tests__/lib/decision/task-breakdown-engine.test.ts`
Expected: PASS (3 tests)

**Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/lib/decision/task-breakdown-engine.ts
git commit -m "feat: implement TaskBreakdownEngine"
```

---

### Task 6: タスク分解バリデーション テスト＆実装

**Files:**
- Create: `__tests__/lib/validation/task-breakdown-input.test.ts`
- Create: `src/lib/validation/task-breakdown-input.ts`

**Step 1: テスト作成**

```typescript
import { describe, it, expect } from "vitest";
import { validateBreakdownInput } from "@/lib/validation/task-breakdown-input";

describe("validateBreakdownInput", () => {
  it("should pass with valid input", () => {
    const result = validateBreakdownInput({
      task: "確定申告の準備",
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when task is empty", () => {
    const result = validateBreakdownInput({
      task: "",
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("タスクを入力してください");
  });

  it("should fail when task exceeds 200 chars", () => {
    const result = validateBreakdownInput({
      task: "a".repeat(201),
      availableTime: 60,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when availableTime is out of range", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 0,
      energyLevel: 3,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when energyLevel is out of range", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 6,
      provider: "openai",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail when provider is invalid", () => {
    const result = validateBreakdownInput({
      task: "タスクA",
      availableTime: 60,
      energyLevel: 3,
      provider: "invalid",
    });
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: テストが失敗することを確認**

Run: `npx vitest run __tests__/lib/validation/task-breakdown-input.test.ts`
Expected: FAIL

**Step 3: バリデーション実装**

```typescript
import featuresConfig from "../../../config/features.json";

const MAX_TASK_LENGTH = 200;

export interface BreakdownInput {
  task: string;
  availableTime: number;
  energyLevel: number;
  provider: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBreakdownInput(
  input: BreakdownInput
): ValidationResult {
  const errors: string[] = [];

  if (input.task.trim().length === 0) {
    errors.push("タスクを入力してください");
  }

  if (input.task.length > MAX_TASK_LENGTH) {
    errors.push(`タスクは${MAX_TASK_LENGTH}文字以内にしてください`);
  }

  if (
    !Number.isInteger(input.availableTime) ||
    input.availableTime < 1 ||
    input.availableTime > 1440
  ) {
    errors.push("利用可能時間を正しく入力してください");
  }

  if (
    !Number.isInteger(input.energyLevel) ||
    input.energyLevel < 1 ||
    input.energyLevel > 5
  ) {
    errors.push("1〜5の範囲で選択してください");
  }

  if (!featuresConfig.enabled_providers.includes(input.provider)) {
    errors.push("エンジンを選択してください");
  }

  return { valid: errors.length === 0, errors };
}
```

**Step 4: テスト実行**

Run: `npx vitest run __tests__/lib/validation/task-breakdown-input.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add __tests__/lib/validation/task-breakdown-input.test.ts src/lib/validation/task-breakdown-input.ts
git commit -m "feat: add task breakdown input validation"
```

---

### Task 7: /api/breakdown ルート実装

**Files:**
- Modify: `src/app/api/breakdown/route.ts` (スタブ → 本実装)

**Step 1: ルート実装**

`decide/route.ts` と同じパターンで実装。スタブを完全に置き換える:

```typescript
import { NextRequest } from "next/server";
import { validateBreakdownInput } from "@/lib/validation/task-breakdown-input";
import { TaskBreakdownEngine } from "@/lib/decision/task-breakdown-engine";
import { createLLMClient } from "@/lib/llm/client-factory";
import { PrismaUsageLogRepository } from "@/lib/db/prisma-usage-log-repository";
import { prisma } from "@/lib/db/prisma";
import { LLMError } from "@/lib/llm/errors";
import type { LLMProvider } from "@/lib/llm/types";
import featuresConfig from "../../../../config/features.json";

const repository = new PrismaUsageLogRepository(prisma);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateBreakdownInput({
      task: body.task ?? "",
      availableTime: body.availableTime ?? 0,
      energyLevel: body.energyLevel ?? 0,
      provider: body.provider ?? "",
    });

    if (!validation.valid) {
      return Response.json({ errors: validation.errors }, { status: 400 });
    }

    const provider = body.provider as LLMProvider;
    const model =
      body.model ??
      featuresConfig.default_model[
        provider as keyof typeof featuresConfig.default_model
      ];

    const client = createLLMClient(provider);
    const engine = new TaskBreakdownEngine(client, repository, provider, model);

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of engine.breakdownStream({
              task: body.task,
              availableTime: body.availableTime,
              energyLevel: body.energyLevel,
            })) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            const errorData = formatError(error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorData })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await engine.breakdown({
      task: body.task,
      availableTime: body.availableTime,
      energyLevel: body.energyLevel,
    });

    return Response.json(result);
  } catch (error) {
    const errorData = formatError(error);
    return Response.json(errorData, { status: errorData.status });
  }
}

function formatError(error: unknown): {
  error: string;
  code?: string;
  status: number;
} {
  if (error instanceof LLMError) {
    const statusMap: Record<string, number> = {
      RATE_LIMITED: 429,
      AUTH_FAILED: 401,
      TIMEOUT: 504,
      SERVER_ERROR: 502,
      NETWORK_ERROR: 503,
    };
    const userMessageMap: Record<string, string> = {
      RATE_LIMITED: "リクエスト制限に達しました。しばらく待ってから再試行してください",
      AUTH_FAILED: "AIエンジンの認証に失敗しました",
      TIMEOUT: "リクエストがタイムアウトしました",
      SERVER_ERROR: "AIエンジンでエラーが発生しました",
      NETWORK_ERROR: "ネットワークエラーが発生しました",
    };
    return {
      error: userMessageMap[error.code] ?? "エラーが発生しました",
      code: error.code,
      status: statusMap[error.code] ?? 500,
    };
  }
  return {
    error: "内部エラーが発生しました",
    status: 500,
  };
}
```

**Step 2: TypeScript チェック**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/api/breakdown/route.ts
git commit -m "feat: implement /api/breakdown route"
```

---

### Task 8: BreakdownResult コンポーネント

**Files:**
- Create: `src/components/BreakdownResult.tsx`

**Step 1: コンポーネント作成**

DecisionResult と同じ MarkdownContent を再利用。BreakdownResult は分解結果の表示専用:

```typescript
"use client";

interface BreakdownResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function BreakdownResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
}: BreakdownResultProps) {
  return (
    <div className="mt-4 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          低エネルギーモードで分解しています（より小さな粒度）
        </div>
      )}
      <div className="prose prose-zinc dark:prose-invert max-w-none rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <MarkdownContent text={content} />
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
      </div>
    </div>
  );
}
```

**注意:** `MarkdownContent` と `formatInlineMarkdown` は現在 `DecisionResult.tsx` にある。共有のため、このステップでは `BreakdownResult.tsx` 内に同じ `MarkdownContent` コンポーネントをインポートできるよう、Task 9 で DecisionResult から export する。

**Step 2: Commit**

```bash
git add src/components/BreakdownResult.tsx
git commit -m "feat: add BreakdownResult component"
```

---

### Task 9: MarkdownContent を共有化 + DecisionResult にボタン追加

**Files:**
- Create: `src/components/MarkdownContent.tsx` (DecisionResult.tsx から抽出)
- Modify: `src/components/DecisionResult.tsx` (MarkdownContent を import + ボタン追加)
- Modify: `src/components/BreakdownResult.tsx` (MarkdownContent を import)

**Step 1: MarkdownContent を独立ファイルに抽出**

`src/components/MarkdownContent.tsx` を作成。`DecisionResult.tsx` の `MarkdownContent` と `formatInlineMarkdown` をそのまま移動:

```typescript
"use client";

import { Fragment } from "react";

export function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.JSX.Element[] = [];

  lines.forEach((line, index) => {
    if (line.startsWith("### ")) {
      const content = line.substring(4);
      elements.push(
        <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </h3>
      );
      return;
    }

    if (line.startsWith("## ")) {
      const content = line.substring(3);
      elements.push(
        <h2 key={index} className="text-xl font-bold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </h2>
      );
      return;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(
        <li key={index} className="ml-4">
          {formatInlineMarkdown(numberedMatch[2])}
        </li>
      );
      return;
    }

    if (line.startsWith("- ")) {
      const content = line.substring(2);
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {formatInlineMarkdown(content)}
        </li>
      );
      return;
    }

    if (line.trim() === "") {
      elements.push(<br key={index} />);
      return;
    }

    elements.push(
      <p key={index}>{formatInlineMarkdown(line)}</p>
    );
  });

  return <>{elements}</>;
}

function formatInlineMarkdown(text: string): React.JSX.Element | string {
  const parts: (React.JSX.Element | string)[] = [];
  let currentIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    parts.push(
      <strong key={`bold-${match.index}`}>{match[1]}</strong>
    );
    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  if (parts.length === 0) {
    return text;
  }

  if (parts.length === 1 && typeof parts[0] === "string") {
    return parts[0];
  }

  return <>{parts}</>;
}
```

**Step 2: DecisionResult を修正**

`DecisionResult.tsx` から `MarkdownContent` と `formatInlineMarkdown` を削除し、`MarkdownContent` を import に変更。`onBreakdown` コールバック prop を追加:

```typescript
"use client";

import { MarkdownContent } from "./MarkdownContent";

interface DecisionResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  onBreakdown?: (task: string) => void;
}

export function DecisionResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
  onBreakdown,
}: DecisionResultProps) {
  // content から「今日の最適タスク」セクションのタスク名を抽出
  const taskMatch = content.match(/### 今日の最適タスク\n(.+)/);
  const selectedTask = taskMatch?.[1]?.trim() ?? "";

  return (
    <div className="mt-6 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          低エネルギーモードで回答しています
        </div>
      )}
      <div className="prose prose-zinc dark:prose-invert max-w-none rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <MarkdownContent text={content} />
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
      </div>
      {onBreakdown && selectedTask && (
        <button
          type="button"
          onClick={() => onBreakdown(selectedTask)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          このタスクを分解する
        </button>
      )}
    </div>
  );
}
```

**Step 3: BreakdownResult を修正して MarkdownContent を import**

`BreakdownResult.tsx` を更新:

```typescript
"use client";

import { MarkdownContent } from "./MarkdownContent";

// ... (props interface は Step 1 と同じ)

export function BreakdownResult({ ... }: BreakdownResultProps) {
  // ... (JSX は Task 8 Step 1 と同じだが MarkdownContent は import 済み)
}
```

**Step 4: TypeScript チェック**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/components/MarkdownContent.tsx src/components/DecisionResult.tsx src/components/BreakdownResult.tsx
git commit -m "refactor: extract MarkdownContent, add breakdown button to DecisionResult"
```

---

### Task 10: TaskDecisionForm にタスク分解状態管理を追加

**Files:**
- Modify: `src/components/TaskDecisionForm.tsx`

**Step 1: タスク分解用の state と handler を追加**

TaskDecisionForm の useReducer に breakdown 状態を追加し、BreakdownResult を表示する:

1. import に `BreakdownResult` を追加
2. State に `breakdownStatus`, `breakdownContent`, `breakdownInputTokens`, `breakdownOutputTokens`, `breakdownError` を追加
3. Action に `START_BREAKDOWN`, `START_BREAKDOWN_STREAMING`, `APPEND_BREAKDOWN_CONTENT`, `COMPLETE_BREAKDOWN`, `BREAKDOWN_ERROR` を追加
4. `handleBreakdown(task: string)` 関数を追加 — `/api/breakdown` を SSE ストリーミングで呼び出す
5. DecisionResult に `onBreakdown={handleBreakdown}` を渡す
6. breakdown 結果を DecisionResult の下に BreakdownResult で表示

```typescript
// State に追加する型
interface State {
  // ... 既存フィールド ...
  breakdownStatus: "idle" | "loading" | "streaming" | "completed" | "error";
  breakdownContent: string;
  breakdownInputTokens: number;
  breakdownOutputTokens: number;
  breakdownError: string | null;
}

// initialState に追加
const initialState: State = {
  // ... 既存フィールド ...
  breakdownStatus: "idle",
  breakdownContent: "",
  breakdownInputTokens: 0,
  breakdownOutputTokens: 0,
  breakdownError: null,
};

// Action に追加
type Action =
  | // ... 既存 ...
  | { type: "START_BREAKDOWN" }
  | { type: "START_BREAKDOWN_STREAMING" }
  | { type: "APPEND_BREAKDOWN_CONTENT"; content: string }
  | { type: "COMPLETE_BREAKDOWN"; inputTokens: number; outputTokens: number }
  | { type: "BREAKDOWN_ERROR"; error: string };

// reducer に追加
case "START_BREAKDOWN":
  return {
    ...state,
    breakdownStatus: "loading",
    breakdownContent: "",
    breakdownInputTokens: 0,
    breakdownOutputTokens: 0,
    breakdownError: null,
  };
case "START_BREAKDOWN_STREAMING":
  return { ...state, breakdownStatus: "streaming" };
case "APPEND_BREAKDOWN_CONTENT":
  return {
    ...state,
    breakdownContent: state.breakdownContent + action.content,
  };
case "COMPLETE_BREAKDOWN":
  return {
    ...state,
    breakdownStatus: "completed",
    breakdownInputTokens: action.inputTokens,
    breakdownOutputTokens: action.outputTokens,
  };
case "BREAKDOWN_ERROR":
  return {
    ...state,
    breakdownStatus: "error",
    breakdownError: action.error,
  };

// RESET は breakdownStatus も idle に戻す
case "RESET":
  return initialState;
```

`handleBreakdown` 関数（`handleSubmit` の下に追加）:

```typescript
const handleBreakdown = async (task: string) => {
  dispatch({ type: "START_BREAKDOWN" });

  try {
    const response = await fetch("/api/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        availableTime,
        energyLevel,
        provider,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      dispatch({
        type: "BREAKDOWN_ERROR",
        error: errorData.errors?.join(", ") ?? errorData.error ?? "エラーが発生しました",
      });
      return;
    }

    dispatch({ type: "START_BREAKDOWN_STREAMING" });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let lastInputTokens = 0;
    let lastOutputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const chunk = JSON.parse(data);
          if (chunk.error) {
            dispatch({ type: "BREAKDOWN_ERROR", error: chunk.error.error });
            return;
          }
          if (chunk.content) {
            dispatch({ type: "APPEND_BREAKDOWN_CONTENT", content: chunk.content });
          }
          if (chunk.usage) {
            lastInputTokens = chunk.usage.inputTokens;
            lastOutputTokens = chunk.usage.outputTokens;
          }
        } catch {
          // skip invalid JSON
        }
      }
    }

    dispatch({
      type: "COMPLETE_BREAKDOWN",
      inputTokens: lastInputTokens,
      outputTokens: lastOutputTokens,
    });
  } catch (error) {
    dispatch({
      type: "BREAKDOWN_ERROR",
      error: error instanceof Error ? error.message : "通信エラー",
    });
  }
};
```

JSX に追加（DecisionResult の下に）:

```tsx
{/* DecisionResult に onBreakdown を渡す */}
<DecisionResult
  content={state.content}
  isAnxietyMode={...}
  provider={...}
  model={...}
  inputTokens={state.inputTokens}
  outputTokens={state.outputTokens}
  onBreakdown={state.status === "completed" ? handleBreakdown : undefined}
/>

{/* タスク分解エラー */}
{state.breakdownStatus === "error" && (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
    <p className="text-sm text-red-700 dark:text-red-300">{state.breakdownError}</p>
  </div>
)}

{/* タスク分解ローディング */}
{state.breakdownStatus === "loading" && (
  <div className="text-sm text-zinc-500 dark:text-zinc-400">タスクを分解中...</div>
)}

{/* タスク分解結果 */}
{(state.breakdownStatus === "streaming" || state.breakdownStatus === "completed") &&
  state.breakdownContent && (
    <BreakdownResult
      content={state.breakdownContent}
      isAnxietyMode={energyLevel <= featuresConfig.anxiety_mode_threshold}
      provider={state.provider || provider}
      model={
        state.model ||
        featuresConfig.default_model[
          provider as keyof typeof featuresConfig.default_model
        ]
      }
      inputTokens={state.breakdownInputTokens}
      outputTokens={state.breakdownOutputTokens}
    />
  )}
```

**Step 2: TypeScript チェック**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/components/TaskDecisionForm.tsx
git commit -m "feat: add task breakdown state management and streaming to form"
```

---

### Task 11: 全体テスト＆ビルド確認

**Files:** (変更なし)

**Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: ALL PASS（既存43件 + 新規11件 = 54件前後）

**Step 2: TypeScript チェック**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Next.js ビルド**

Run: `npx next build`
Expected: Build success

**Step 4: 最終コミット（必要に応じて）**

```bash
git add -A
git commit -m "feat: complete task breakdown feature (spec 3.2)"
```
