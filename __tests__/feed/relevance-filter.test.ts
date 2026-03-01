import { describe, it, expect, vi, beforeEach } from "vitest";
import { RelevanceFilter } from "@/lib/feed/relevance-filter";
import type { LLMClient } from "@/lib/llm/types";
import type { FeedArticleData } from "@/lib/feed/types";
import { createMockLogger } from "../helpers/mock-logger";

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(
    "キーワード: {{keywords}}\n記事一覧:\n{{articles}}"
  ),
}));

const mockLLMClient: LLMClient = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  extractUsage: vi.fn(),
};
const mockLogger = createMockLogger();

function makeArticle(
  overrides: Partial<FeedArticleData> = {}
): FeedArticleData {
  return {
    title: "デフォルトタイトル",
    url: "https://example.com/article",
    source: "yahoo_news_jp",
    category: "news",
    snippet: "デフォルトスニペット",
    publishedAt: new Date("2026-03-01"),
    keyword: "__category_yahoo_news_jp",
    ...overrides,
  };
}

describe("RelevanceFilter", () => {
  let filter: RelevanceFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new RelevanceFilter(mockLLMClient, "gpt-4o-mini", mockLogger);
  });

  it("関連ありと判定された記事のみ返す", async () => {
    const articles = [
      makeArticle({ title: "AI最新動向" }),
      makeArticle({ title: "交通事故ニュース" }),
      makeArticle({ title: "機械学習フレームワーク" }),
    ];

    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify([
        { index: 0, relevant: true },
        { index: 1, relevant: false },
        { index: 2, relevant: true },
      ]),
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    });

    const result = await filter.filterArticles(articles, ["AI", "機械学習"]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("AI最新動向");
    expect(result[1].title).toBe("機械学習フレームワーク");
    expect(mockLLMClient.chat).toHaveBeenCalledOnce();
  });

  it("空の記事配列は空配列を返す", async () => {
    const result = await filter.filterArticles([], ["AI"]);
    expect(result).toEqual([]);
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });

  it("空のキーワード配列はすべての記事を返す", async () => {
    const articles = [makeArticle()];
    const result = await filter.filterArticles(articles, []);
    expect(result).toHaveLength(1);
    expect(mockLLMClient.chat).not.toHaveBeenCalled();
  });

  it("LLM失敗時はすべての記事をそのまま返す（フォールバック）", async () => {
    const articles = [makeArticle(), makeArticle()];
    vi.mocked(mockLLMClient.chat).mockRejectedValue(new Error("API error"));

    const result = await filter.filterArticles(articles, ["AI"]);
    expect(result).toHaveLength(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Relevance filter failed, passing all articles",
      expect.objectContaining({ message: "API error" })
    );
  });

  it("JSONが含まれないレスポンスはすべての記事を返す", async () => {
    const articles = [makeArticle()];
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: "判定できませんでした",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await filter.filterArticles(articles, ["AI"]);
    expect(result).toHaveLength(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Relevance filter response has no JSON array",
      expect.any(Object)
    );
  });

  it("レスポンスが配列でない場合はすべての記事を返す", async () => {
    const articles = [makeArticle()];
    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: '判定結果: {"not": "array"}',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await filter.filterArticles(articles, ["AI"]);
    expect(result).toHaveLength(1);
    // JSON配列が見つからないため "no JSON array" の分岐に入る
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Relevance filter response has no JSON array",
      expect.any(Object)
    );
  });

  it("markdownコードフェンス内のJSONもパースできる", async () => {
    const articles = [
      makeArticle({ title: "関連記事" }),
      makeArticle({ title: "無関係記事" }),
    ];

    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: '```json\n[{"index": 0, "relevant": true}, {"index": 1, "relevant": false}]\n```',
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    });

    const result = await filter.filterArticles(articles, ["テスト"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("関連記事");
  });

  it("不正なindexを含むレスポンスは安全に無視する", async () => {
    const articles = [makeArticle({ title: "記事" })];

    vi.mocked(mockLLMClient.chat).mockResolvedValue({
      content: JSON.stringify([
        { index: 0, relevant: true },
        { index: 99, relevant: true }, // 存在しないindex
        { index: "bad", relevant: true }, // 不正な型
      ]),
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    });

    const result = await filter.filterArticles(articles, ["テスト"]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("記事");
  });
});
