import { XMLParser } from "fast-xml-parser";
import type { Logger } from "../logger/types";
import type { FeedArticleData } from "./types";
import feedConfig from "../../../config/feed.json";

export class NewsFetcher {
  private readonly parser: XMLParser;

  constructor(private readonly logger: Logger) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
    });
  }

  async fetchByKeyword(keyword: string): Promise<FeedArticleData[]> {
    const queries: { q: string; category: "news" | "blog" }[] = [
      { q: keyword, category: "news" },
      { q: `${keyword} ブログ コラム`, category: "blog" },
    ];

    const results = await Promise.allSettled(
      queries.map(({ q, category }) => this.fetchRss(q, keyword, category))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<FeedArticleData[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);
  }

  private async fetchRss(
    query: string,
    keyword: string,
    category: "news" | "blog"
  ): Promise<FeedArticleData[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), feedConfig.fetch_timeout_ms);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn("RSS fetch failed", { query, status: response.status });
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
        category,
        snippet: String(item.description ?? "").slice(0, 1000),
        publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
        keyword,
      }));
    } catch (error) {
      this.logger.error("RSS fetch error", { query, message: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}
