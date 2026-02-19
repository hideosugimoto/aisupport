# パーソナルフィード Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 羅針盤データからLLMでキーワード自動生成し、Google News RSSでパーソナライズされたニュース・記事を収集・表示する

**Architecture:** 羅針盤テキスト → LLM → 検索キーワード → Google News RSS → DB保存 → /feed ページ表示。ハイブリッド方式（定期バッチ + 手動リフレッシュ）。Pro限定機能。

**Tech Stack:** Next.js App Router, Prisma, fast-xml-parser, OpenAI (gpt-4o-mini), Google News RSS

---

## Task 112: DBスキーマ + Config + プラン制限追加

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `config/feed.json`
- Modify: `config/plans.json`
- Modify: `src/lib/billing/plan-gate.ts`

### Step 1: Prismaスキーマに FeedKeyword, FeedArticle モデル追加

`prisma/schema.prisma` の末尾に追加:

```prisma
model FeedKeyword {
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id")
  keyword   String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("feed_keywords")
}

model FeedArticle {
  id          Int      @id @default(autoincrement())
  userId      String   @map("user_id")
  title       String
  url         String
  source      String
  category    String
  snippet     String
  publishedAt DateTime @map("published_at")
  fetchedAt   DateTime @default(now()) @map("fetched_at")
  keyword     String
  isRead      Boolean  @default(false) @map("is_read")

  @@unique([userId, url])
  @@index([userId, category])
  @@index([userId, fetchedAt])
  @@map("feed_articles")
}
```

### Step 2: config/feed.json 作成

```json
{
  "max_keywords": 10,
  "article_retention_days": 30,
  "fetch_timeout_ms": 10000,
  "max_articles_per_keyword": 20,
  "page_size": 20,
  "keyword_model": "gpt-4o-mini"
}
```

### Step 3: config/plans.json に feed_enabled 追加

`config/plans.json` の free プランに `"feed_enabled": false`、pro プランに `"feed_enabled": true` を追加。

### Step 4: PlanInfo に feedEnabled 追加

`src/lib/billing/plan-gate.ts`:
- `PlanInfo` インターフェースに `feedEnabled: boolean` 追加
- `getUserPlan()` の return に `feedEnabled: planConfig.feed_enabled` 追加

### Step 5: Prisma generate + マイグレーション

Run: `npx prisma generate && npx prisma db push`
Expected: スキーマが同期され、新テーブルが作成される

### Step 6: 既存テストが壊れていないことを確認

Run: `npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: 全テスト PASS

### Step 7: Commit

```bash
git add prisma/schema.prisma config/feed.json config/plans.json src/lib/billing/plan-gate.ts
git commit -m "feat: パーソナルフィード用DBスキーマ・Config・プラン制限追加"
```

---

## Task 113: 型定義 + キーワードジェネレーター（TDD）

**Files:**
- Create: `src/lib/feed/types.ts`
- Create: `src/lib/feed/keyword-generator.ts`
- Create: `prompts/feed/generate-keywords.md`
- Test: `__tests__/feed/keyword-generator.test.ts`

### Step 1: 型定義を作成

`src/lib/feed/types.ts`:

```typescript
export interface FeedArticleData {
  title: string;
  url: string;
  source: string;
  category: "news" | "blog";
  snippet: string;
  publishedAt: Date;
  keyword: string;
}

export interface GeneratedKeywords {
  keywords: string[];
}
```

### Step 2: テストを書く（失敗するテスト）

`__tests__/feed/keyword-generator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeywordGenerator } from "@/lib/feed/keyword-generator";
import type { LLMClient } from "@/lib/llm/types";
import { createMockLogger } from "../helpers/mock-logger";

vi.mock("@/lib/llm/prompt-builder", () => ({
  loadTemplate: vi.fn().mockReturnValue("template {{compass_items}}"),
  sanitizePromptInput: vi.fn().mockImplementation((text: string) => text),
}));

const mockLLMClient: LLMClient = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  extractUsage: vi.fn(),
};
const mockLogger = createMockLogger();

describe("KeywordGenerator", () => {
  let generator: KeywordGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new KeywordGenerator(mockLLMClient, "gpt-4o-mini", mockLogger);
  });

  it("should generate keywords from compass items", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify(["Web開発", "TypeScript", "副業 エンジニア"]),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generator.generate([
      { title: "Webエンジニアになりたい", content: "フロントエンド開発を学びたい" },
      { title: "副業で稼ぎたい", content: "エンジニアスキルを活かして副収入" },
    ]);

    expect(result).toEqual(["Web開発", "TypeScript", "副業 エンジニア"]);
    expect(mockLLMClient.chat).toHaveBeenCalledOnce();
  });

  it("should return empty array when compass items are empty", async () => {
    const result = await generator.generate([]);
    expect(result).toEqual([]);
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });

  it("should return empty array on invalid JSON response", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: "これはJSONではありません",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generator.generate([
      { title: "テスト", content: "テスト内容" },
    ]);

    expect(result).toEqual([]);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should truncate keywords to max 10", async () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => `keyword-${i}`);
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify(tooMany),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generator.generate([
      { title: "テスト", content: "テスト内容" },
    ]);

    expect(result).toHaveLength(10);
  });

  it("should handle markdown code fence in response", async () => {
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: '```json\n["AI", "機械学習"]\n```',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generator.generate([
      { title: "AI学習", content: "機械学習を勉強中" },
    ]);

    expect(result).toEqual(["AI", "機械学習"]);
  });
});
```

### Step 3: テストが失敗することを確認

Run: `npx vitest run __tests__/feed/keyword-generator.test.ts`
Expected: FAIL（`KeywordGenerator` が存在しない）

### Step 4: プロンプトテンプレート作成

`prompts/feed/generate-keywords.md`:

```markdown
あなたはユーザーの目標・関心事に基づいてニュース検索キーワードを生成するアシスタントです。

以下のユーザーの目標・関心事をもとに、最新ニュースを検索するための具体的なキーワードを5〜10個生成してください。

## ルール
- 各キーワードは日本語で、1〜4語程度の検索クエリとして使えるもの
- 具体的で検索精度が高いキーワードを優先
- 抽象的すぎるもの（例:「成功」「幸せ」）は避ける
- ニュース記事がヒットしやすいキーワードを選ぶ

## ユーザーの目標・関心事

{{compass_items}}

## 出力フォーマット

JSON配列のみで回答してください。説明は不要です。

```json
["キーワード1", "キーワード2", "キーワード3"]
```
```

### Step 5: KeywordGenerator を実装

`src/lib/feed/keyword-generator.ts`:

```typescript
import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import { loadTemplate, sanitizePromptInput } from "../llm/prompt-builder";
import feedConfig from "../../../config/feed.json";

export interface CompassItemInput {
  title: string;
  content: string;
}

export class KeywordGenerator {
  constructor(
    private readonly llmClient: LLMClient,
    private readonly model: string,
    private readonly logger: Logger
  ) {}

  async generate(compassItems: CompassItemInput[]): Promise<string[]> {
    if (compassItems.length === 0) {
      this.logger.info("No compass items, skipping keyword generation");
      return [];
    }

    try {
      const itemsText = compassItems
        .map((item) => `- ${sanitizePromptInput(item.title)}: ${sanitizePromptInput(item.content).slice(0, 500)}`)
        .join("\n");

      const template = loadTemplate("feed", "generate-keywords.md");
      const prompt = template.replaceAll("{{compass_items}}", itemsText);

      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      });

      let jsonText = response.content.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) || !parsed.every((k) => typeof k === "string")) {
        this.logger.warn("Invalid keyword response format", { raw: JSON.stringify(parsed).slice(0, 300) });
        return [];
      }

      return parsed.slice(0, feedConfig.max_keywords);
    } catch (error) {
      this.logger.warn("Keyword generation failed", { message: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}
```

### Step 6: テストが通ることを確認

Run: `npx vitest run __tests__/feed/keyword-generator.test.ts`
Expected: 全テスト PASS

### Step 7: Commit

```bash
git add src/lib/feed/ prompts/feed/ __tests__/feed/
git commit -m "feat: キーワードジェネレーター実装（TDD）"
```

---

## Task 114: ニュースフェッチャー（TDD）

**Files:**
- Create: `src/lib/feed/news-fetcher.ts`
- Test: `__tests__/feed/news-fetcher.test.ts`

### Step 1: fast-xml-parser をインストール

Run: `npm install fast-xml-parser`

### Step 2: テストを書く（失敗するテスト）

`__tests__/feed/news-fetcher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createMockLogger } from "../helpers/mock-logger";

const mockLogger = createMockLogger();

// Sample Google News RSS XML
const sampleRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Web開発 - Google News</title>
    <item>
      <title>React 19の新機能まとめ</title>
      <link>https://example.com/react-19</link>
      <description>React 19がリリースされ...</description>
      <pubDate>Wed, 19 Feb 2026 10:00:00 GMT</pubDate>
      <source url="https://example.com">Tech Blog</source>
    </item>
    <item>
      <title>Next.js 16の破壊的変更</title>
      <link>https://example.com/nextjs-16</link>
      <description>Next.js 16で注意すべき...</description>
      <pubDate>Tue, 18 Feb 2026 08:00:00 GMT</pubDate>
      <source url="https://example.com">Dev News</source>
    </item>
  </channel>
</rss>`;

const emptyRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Empty</title></channel></rss>`;

describe("NewsFetcher", () => {
  let fetcher: NewsFetcher;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    fetcher = new NewsFetcher(mockLogger);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should parse RSS XML into article array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleRssXml),
    });

    const articles = await fetcher.fetchByKeyword("Web開発");

    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe("React 19の新機能まとめ");
    expect(articles[0].url).toBe("https://example.com/react-19");
    expect(articles[0].snippet).toBe("React 19がリリースされ...");
    expect(articles[0].keyword).toBe("Web開発");
    expect(articles[0].source).toBe("google_news");
    expect(articles[0].category).toBe("news");
  });

  it("should return empty array for empty RSS", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(emptyRssXml),
    });

    const articles = await fetcher.fetchByKeyword("テスト");
    expect(articles).toEqual([]);
  });

  it("should return empty array on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const articles = await fetcher.fetchByKeyword("テスト");
    expect(articles).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should return empty array on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Too Many Requests"),
    });

    const articles = await fetcher.fetchByKeyword("テスト");
    expect(articles).toEqual([]);
  });
});
```

### Step 3: テストが失敗することを確認

Run: `npx vitest run __tests__/feed/news-fetcher.test.ts`
Expected: FAIL（`NewsFetcher` が存在しない）

### Step 4: NewsFetcher を実装

`src/lib/feed/news-fetcher.ts`:

```typescript
import { XMLParser } from "fast-xml-parser";
import type { Logger } from "../logger/types";
import type { FeedArticleData } from "./types";
import feedConfig from "../../../config/feed.json";

export class NewsFetcher {
  private readonly parser: XMLParser;

  constructor(private readonly logger: Logger) {
    this.parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  }

  async fetchByKeyword(keyword: string): Promise<FeedArticleData[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), feedConfig.fetch_timeout_ms);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn("RSS fetch failed", { keyword, status: response.status });
        return [];
      }

      const xml = await response.text();
      const parsed = this.parser.parse(xml);
      const items = parsed?.rss?.channel?.item;

      if (!items) return [];

      const itemArray = Array.isArray(items) ? items : [items];

      return itemArray.slice(0, feedConfig.max_articles_per_keyword).map((item: Record<string, unknown>) => ({
        title: String(item.title ?? "").slice(0, 500),
        url: String(item.link ?? ""),
        source: "google_news",
        category: "news" as const,
        snippet: String(item.description ?? "").slice(0, 1000),
        publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
        keyword,
      }));
    } catch (error) {
      this.logger.error("RSS fetch error", { keyword, message: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}
```

### Step 5: テストが通ることを確認

Run: `npx vitest run __tests__/feed/news-fetcher.test.ts`
Expected: 全テスト PASS

### Step 6: Commit

```bash
git add src/lib/feed/news-fetcher.ts __tests__/feed/news-fetcher.test.ts package.json package-lock.json
git commit -m "feat: ニュースフェッチャー実装（Google News RSS対応）"
```

---

## Task 115: API Routes — キーワード管理 + フィード取得

**Files:**
- Create: `src/app/api/feed/route.ts`
- Create: `src/app/api/feed/refresh/route.ts`
- Create: `src/app/api/feed/keywords/route.ts`
- Create: `src/app/api/feed/keywords/generate/route.ts`
- Create: `src/app/api/feed/[id]/route.ts`

### Step 1: GET /api/feed — 記事一覧取得

`src/app/api/feed/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed");

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json(
        { error: "フィード機能はProプランで利用できます" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? "news";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const skip = (page - 1) * feedConfig.page_size;

    const [articles, total] = await Promise.all([
      prisma.feedArticle.findMany({
        where: { userId, category },
        orderBy: { publishedAt: "desc" },
        skip,
        take: feedConfig.page_size,
      }),
      prisma.feedArticle.count({ where: { userId, category } }),
    ]);

    return Response.json({
      articles,
      pagination: { page, pageSize: feedConfig.page_size, total },
    });
  } catch (error) {
    try { return handleAuthError(error); }
    catch { logger.error("Feed fetch error"); return Response.json({ error: "Internal error" }, { status: 500 }); }
  }
}
```

### Step 2: POST /api/feed/keywords/generate — キーワード生成

`src/app/api/feed/keywords/generate/route.ts`:

```typescript
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { createLLMClient } from "@/lib/llm/client-factory";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { KeywordGenerator } from "@/lib/feed/keyword-generator";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("api:feed-keywords");

export async function POST() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json({ error: "フィード機能はProプランで利用できます" }, { status: 403 });
    }

    // 羅針盤アイテム取得
    const compassItems = await prisma.compassItem.findMany({
      where: { userId },
      select: { title: true, content: true },
    });

    if (compassItems.length === 0) {
      return Response.json({ error: "羅針盤にアイテムを追加してからキーワードを生成してください" }, { status: 400 });
    }

    // LLMでキーワード生成
    const { apiKey } = await resolveApiKey(userId, "openai");
    const llmClient = createLLMClient("openai", undefined, false, apiKey);
    const generator = new KeywordGenerator(llmClient, feedConfig.keyword_model, logger.child("generator"));
    const keywords = await generator.generate(compassItems);

    if (keywords.length === 0) {
      return Response.json({ error: "キーワードの生成に失敗しました" }, { status: 500 });
    }

    // 既存キーワード削除 → 新規保存
    await prisma.feedKeyword.deleteMany({ where: { userId } });
    await prisma.feedKeyword.createMany({
      data: keywords.map((keyword) => ({ userId, keyword })),
    });

    logger.info("Keywords generated", { userId, count: keywords.length });
    return Response.json({ keywords });
  } catch (error) {
    try { return handleAuthError(error); }
    catch { logger.error("Keyword generation error"); return Response.json({ error: "Internal error" }, { status: 500 }); }
  }
}
```

### Step 3: GET /api/feed/keywords — キーワード一覧

`src/app/api/feed/keywords/route.ts`:

```typescript
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json({ error: "フィード機能はProプランで利用できます" }, { status: 403 });
    }

    const keywords = await prisma.feedKeyword.findMany({
      where: { userId },
      select: { id: true, keyword: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ keywords });
  } catch (error) {
    try { return handleAuthError(error); }
    catch { return Response.json({ error: "Internal error" }, { status: 500 }); }
  }
}
```

### Step 4: POST /api/feed/refresh — 手動リフレッシュ

`src/app/api/feed/refresh/route.ts`:

```typescript
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:feed-refresh");

export async function POST() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json({ error: "フィード機能はProプランで利用できます" }, { status: 403 });
    }

    const keywords = await prisma.feedKeyword.findMany({ where: { userId } });
    if (keywords.length === 0) {
      return Response.json({ error: "先にキーワードを生成してください" }, { status: 400 });
    }

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    let newCount = 0;

    for (const { keyword } of keywords) {
      const articles = await fetcher.fetchByKeyword(keyword);
      for (const article of articles) {
        try {
          await prisma.feedArticle.upsert({
            where: { userId_url: { userId, url: article.url } },
            update: {},
            create: {
              userId,
              title: article.title,
              url: article.url,
              source: article.source,
              category: article.category,
              snippet: article.snippet,
              publishedAt: article.publishedAt,
              keyword: article.keyword,
            },
          });
          newCount++;
        } catch {
          // duplicate — skip
        }
      }
    }

    logger.info("Feed refreshed", { userId, newCount });
    return Response.json({ newCount });
  } catch (error) {
    try { return handleAuthError(error); }
    catch { logger.error("Feed refresh error"); return Response.json({ error: "Internal error" }, { status: 500 }); }
  }
}
```

### Step 5: PATCH /api/feed/[id] — 既読更新

`src/app/api/feed/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const articleId = Number(id);

    if (Number.isNaN(articleId)) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }

    const article = await prisma.feedArticle.findFirst({
      where: { id: articleId, userId },
    });

    if (!article) {
      return Response.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    await prisma.feedArticle.update({
      where: { id: articleId },
      data: { isRead: Boolean(body.isRead) },
    });

    return Response.json({ success: true });
  } catch (error) {
    try { return handleAuthError(error); }
    catch { return Response.json({ error: "Internal error" }, { status: 500 }); }
  }
}
```

### Step 6: ビルドが通ることを確認

Run: `npx vitest run && npx next build 2>&1 | tail -5`
Expected: テスト PASS、ビルド成功

### Step 7: Commit

```bash
git add src/app/api/feed/
git commit -m "feat: フィードAPI Routes実装（CRUD + キーワード生成 + リフレッシュ）"
```

---

## Task 116: フィードページ UI

**Files:**
- Create: `src/app/(app)/feed/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

### Step 1: フィードページ作成

`src/app/(app)/feed/page.tsx`:

サーバーコンポーネントとして:
- `requireAuth()` → `getUserPlan()` でプラン判定
- Freeユーザー → アップグレード案内を表示
- Proユーザー → キーワード取得、記事一覧表示

クライアントコンポーネント部分:
- タブ切替（ニュース / ブログ・コラム）
- 記事カード一覧（タイトル、ソース、日時、概要、キーワードタグ）
- 「最新を取得」ボタン（POST /api/feed/refresh → リロード）
- 「キーワードを生成する」ボタン（POST /api/feed/keywords/generate）
- キーワードチップ表示
- 「もっと読む」ページネーション
- 既存ダッシュボードと同じ Tailwind CSS スタイル（zinc ベース、dark mode対応）

### Step 2: ダッシュボードのナビに「フィード」リンク追加

`src/app/(app)/dashboard/page.tsx` の `<nav>` 内、「羅針盤」リンクの前に追加:

```tsx
<Link
  href="/feed"
  className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
>
  フィード
</Link>
```

### Step 3: ビルドが通ることを確認

Run: `npx next build 2>&1 | tail -5`
Expected: ビルド成功

### Step 4: Commit

```bash
git add src/app/\(app\)/feed/ src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: フィードページUI + ナビゲーション追加"
```

---

## Task 117: ビルド + テスト全体検証

**Files:** なし（検証のみ）

### Step 1: 全テスト実行

Run: `npx vitest run --reporter=verbose`
Expected: 全テスト PASS

### Step 2: ビルド検証

Run: `npx next build`
Expected: ビルド成功

### Step 3: Commit（必要に応じてfixがあれば）

---

## Task 118: Cron バッチ処理

**Files:**
- Create: `src/app/api/feed/cron/route.ts`
- Modify: `vercel.json`

### Step 1: POST /api/feed/cron 実装

`src/app/api/feed/cron/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createLogger } from "@/lib/logger";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("cron:feed");

export async function POST(request: NextRequest) {
  // CRON_SECRET認証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 全Proユーザーのキーワードを取得（subscription.plan = "pro"のユーザー）
    const proUsers = await prisma.subscription.findMany({
      where: { plan: "pro", status: "active" },
      select: { userId: true },
    });

    const fetcher = new NewsFetcher(logger.child("fetcher"));
    let totalNew = 0;

    for (const { userId } of proUsers) {
      const keywords = await prisma.feedKeyword.findMany({ where: { userId } });

      for (const { keyword } of keywords) {
        const articles = await fetcher.fetchByKeyword(keyword);
        for (const article of articles) {
          try {
            await prisma.feedArticle.upsert({
              where: { userId_url: { userId, url: article.url } },
              update: {},
              create: {
                userId, title: article.title, url: article.url,
                source: article.source, category: article.category,
                snippet: article.snippet, publishedAt: article.publishedAt,
                keyword: article.keyword,
              },
            });
            totalNew++;
          } catch { /* duplicate */ }
        }
      }
    }

    // 古い記事の削除
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - feedConfig.article_retention_days);
    const deleted = await prisma.feedArticle.deleteMany({
      where: { fetchedAt: { lt: cutoff } },
    });

    logger.info("Cron completed", { users: proUsers.length, totalNew, deleted: deleted.count });
    return Response.json({ users: proUsers.length, totalNew, deleted: deleted.count });
  } catch (error) {
    logger.error("Cron error", { message: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### Step 2: vercel.json に cron 設定追加

既存の `vercel.json` に `crons` 配列を追加（なければ作成）:

```json
{
  "crons": [
    {
      "path": "/api/feed/cron",
      "schedule": "0 6 * * *"
    }
  ]
}
```

毎朝6時（UTC）= 日本時間15時に実行。

### Step 3: Commit

```bash
git add src/app/api/feed/cron/ vercel.json
git commit -m "feat: フィードCronバッチ処理（1日1回自動取得 + 古い記事削除）"
```

---

## Task 119: E2E動作確認 + デプロイ

### Step 1: ローカル動作確認

- `npm run dev` でローカル起動
- Pro ユーザーで `/feed` ページアクセス
- キーワード生成ボタン → キーワードが表示される
- 手動リフレッシュ → ニュース記事が表示される
- タブ切替が動作する
- Free ユーザーで403 + アップグレード案内が表示される

### Step 2: Vercel デプロイ

Run: `vercel deploy` or git push
Expected: デプロイ成功

### Step 3: 本番動作確認

- Pro ユーザーでフィードの全フロー確認
- CRON_SECRET 環境変数を Vercel に設定
