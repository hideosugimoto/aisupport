import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NewsFetcher } from "@/lib/feed/news-fetcher";
import { createMockLogger } from "../helpers/mock-logger";

const mockLogger = createMockLogger();

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

  it("should parse RSS XML into news and blog articles", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(sampleRssXml),
    });
    const articles = await fetcher.fetchByKeyword("Web開発");
    // 2 queries (news + blog) × 2 items each = 4 articles
    expect(articles).toHaveLength(4);

    const newsArticles = articles.filter((a) => a.category === "news");
    const blogArticles = articles.filter((a) => a.category === "blog");
    expect(newsArticles).toHaveLength(2);
    expect(blogArticles).toHaveLength(2);

    expect(newsArticles[0].title).toBe("React 19の新機能まとめ");
    expect(newsArticles[0].url).toBe("https://example.com/react-19");
    expect(newsArticles[0].snippet).toBe("React 19がリリースされ...");
    expect(newsArticles[0].keyword).toBe("Web開発");
    expect(newsArticles[0].source).toBe("google_news");
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
