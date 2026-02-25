import { XMLParser } from "fast-xml-parser";
import type { Logger } from "../logger/types";
import type { FeedArticleData, FeedSource } from "./types";
import feedConfig from "../../../config/feed.json";

type SourceConfig = { enabled: boolean; lang: string; label: string; max_articles: number };
const sources = feedConfig.sources as Record<string, SourceConfig>;

export class NewsFetcher {
  private readonly parser: XMLParser;

  constructor(private readonly logger: Logger) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
    });
  }

  /**
   * キーワード検索系ソース（Google News, Bing JP/EN, Hacker News）から記事を取得
   * @param keyword 日本語キーワード
   * @param keywordEn 英語翻訳キーワード（EN系ソース用）
   */
  async fetchByKeyword(
    keyword: string,
    keywordEn?: string
  ): Promise<FeedArticleData[]> {
    const tasks: Promise<FeedArticleData[]>[] = [];

    // 日本語ソース
    if (sources.google_news?.enabled) {
      tasks.push(this.fetchGoogleNews(keyword, "news"));
      tasks.push(this.fetchGoogleNews(`${keyword} ブログ コラム`, "blog", keyword));
    }
    if (sources.bing_news_jp?.enabled) {
      tasks.push(this.fetchBingNews(keyword, "ja", "bing_news_jp"));
    }

    // 英語ソース（翻訳キーワードがある場合のみ）
    if (keywordEn) {
      if (sources.bing_news_en?.enabled) {
        tasks.push(this.fetchBingNews(keywordEn, "en", "bing_news_en", keyword));
      }
      if (sources.hacker_news?.enabled) {
        tasks.push(this.fetchHackerNews(keywordEn, keyword));
      }
    }

    const results = await Promise.allSettled(tasks);
    return results
      .filter(
        (r): r is PromiseFulfilledResult<FeedArticleData[]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value);
  }

  /**
   * カテゴリ固定フィード（Yahoo, BBC, TechCrunch）を取得
   * keywordは `__category_{source}` 形式で設定
   */
  async fetchCategoryFeeds(): Promise<FeedArticleData[]> {
    const tasks: Promise<FeedArticleData[]>[] = [];

    if (sources.yahoo_news_jp?.enabled) {
      tasks.push(this.fetchYahooNews());
    }
    if (sources.bbc_news?.enabled) {
      tasks.push(this.fetchBbcNews());
    }
    if (sources.techcrunch?.enabled) {
      tasks.push(this.fetchTechCrunch());
    }

    const results = await Promise.allSettled(tasks);
    return results
      .filter(
        (r): r is PromiseFulfilledResult<FeedArticleData[]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value);
  }

  /**
   * OGP取得が必要な記事かどうかを判定
   * RSS内で画像が取得できないソースが対象
   */
  static needsOgpFetch(article: FeedArticleData): boolean {
    // 既にimageUrlがあればOGP不要
    if (article.imageUrl) return false;
    // Yahoo, TechCrunchはOGPから画像取得が必要
    const ogpSources: FeedSource[] = ["yahoo_news_jp", "techcrunch"];
    return ogpSources.includes(article.source);
  }

  // ─── ソース別フェッチメソッド ────────────────────────

  private async fetchGoogleNews(
    query: string,
    category: "news" | "blog",
    originalKeyword?: string
  ): Promise<FeedArticleData[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
    const items = await this.fetchAndParseRss(url, "google_news");
    if (!items) return [];

    const max = sources.google_news?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: String(item.link ?? ""),
      source: "google_news" as FeedSource,
      category,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: originalKeyword ?? query,
    }));
  }

  private async fetchBingNews(
    query: string,
    lang: "ja" | "en",
    source: "bing_news_jp" | "bing_news_en",
    originalKeyword?: string
  ): Promise<FeedArticleData[]> {
    const mkt = lang === "ja" ? "ja-JP" : "en-US";
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${mkt}`;
    const items = await this.fetchAndParseRss(url, source);
    if (!items) return [];

    const max = sources[source]?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: extractBingUrl(String(item.link ?? "")),
      source: source as FeedSource,
      category: "news" as const,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: originalKeyword ?? query,
      imageUrl: extractBingImage(item),
    }));
  }

  private async fetchYahooNews(): Promise<FeedArticleData[]> {
    const url = "https://news.yahoo.co.jp/rss/topics/top-picks.xml";
    const items = await this.fetchAndParseRss(url, "yahoo_news_jp");
    if (!items) return [];

    const max = sources.yahoo_news_jp?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: String(item.link ?? ""),
      source: "yahoo_news_jp" as FeedSource,
      category: "news" as const,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: "__category_yahoo_news_jp",
    }));
  }

  private async fetchBbcNews(): Promise<FeedArticleData[]> {
    const url = "https://feeds.bbci.co.uk/news/world/rss.xml";
    const items = await this.fetchAndParseRss(url, "bbc_news");
    if (!items) return [];

    const max = sources.bbc_news?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: String(item.link ?? ""),
      source: "bbc_news" as FeedSource,
      category: "news" as const,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: "__category_bbc_news",
      imageUrl: extractMediaThumbnail(item),
    }));
  }

  private async fetchTechCrunch(): Promise<FeedArticleData[]> {
    const url = "https://techcrunch.com/feed/";
    const items = await this.fetchAndParseRss(url, "techcrunch");
    if (!items) return [];

    const max = sources.techcrunch?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: String(item.link ?? ""),
      source: "techcrunch" as FeedSource,
      category: "blog" as const,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: "__category_techcrunch",
    }));
  }

  private async fetchHackerNews(
    query: string,
    originalKeyword: string
  ): Promise<FeedArticleData[]> {
    const url = `https://hnrss.org/newest?q=${encodeURIComponent(query)}&count=${sources.hacker_news?.max_articles ?? feedConfig.max_articles_per_source}`;
    const items = await this.fetchAndParseRss(url, "hacker_news");
    if (!items) return [];

    const max = sources.hacker_news?.max_articles ?? feedConfig.max_articles_per_source;
    return items.slice(0, max).map((item) => ({
      title: String(item.title ?? "").slice(0, 500),
      url: String(item.link ?? ""),
      source: "hacker_news" as FeedSource,
      category: "news" as const,
      snippet: stripHtmlTags(String(item.description ?? "")).slice(0, 1000),
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : new Date(),
      keyword: originalKeyword,
    }));
  }

  // ─── 共通ヘルパー ────────────────────────

  private async fetchAndParseRss(
    url: string,
    source: string
  ): Promise<Record<string, unknown>[] | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        feedConfig.fetch_timeout_ms
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
      });

      if (!response.ok) {
        clearTimeout(timeout);
        this.logger.warn("RSS fetch failed", { source, status: response.status });
        return null;
      }

      const xml = await response.text();
      clearTimeout(timeout);
      const parsed = this.parser.parse(xml);

      // RSS 2.0
      const rssItems = parsed?.rss?.channel?.item;
      if (rssItems) {
        return Array.isArray(rssItems) ? rssItems : [rssItems];
      }

      // Atom (TechCrunch等)
      const atomEntries = parsed?.feed?.entry;
      if (atomEntries) {
        const entries = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
        // Atomエントリをrssアイテム形式に正規化
        return entries.map((entry: Record<string, unknown>) => ({
          title: entry.title,
          link:
            typeof entry.link === "string"
              ? entry.link
              : (entry.link as Record<string, string>)?.["@_href"] ?? "",
          description: entry.summary ?? entry.content ?? "",
          pubDate: entry.published ?? entry.updated ?? "",
        }));
      }

      this.logger.warn("No items in RSS feed", { source, url });
      return null;
    } catch (error) {
      this.logger.error("RSS fetch error", {
        source,
        url,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

// ─── ユーティリティ関数 ────────────────────────

/** BingリダイレクトURLから実URLを抽出 */
function extractBingUrl(bingUrl: string): string {
  try {
    const urlObj = new URL(bingUrl);
    return urlObj.searchParams.get("url") ?? urlObj.searchParams.get("r") ?? bingUrl;
  } catch {
    return bingUrl;
  }
}

/** Bing RSS の News:Image からサムネイルURLを抽出 */
function extractBingImage(item: Record<string, unknown>): string | undefined {
  // News:Image タグ（fast-xml-parserでは "News:Image" もしくは "news:Image"）
  const imageNode =
    item["News:Image"] ?? item["news:Image"] ?? item["News:image"];
  if (!imageNode) return undefined;

  if (typeof imageNode === "string") return imageNode;
  if (typeof imageNode === "object" && imageNode !== null) {
    const obj = imageNode as Record<string, unknown>;
    // contentUrl属性やテキストノード
    return (
      (obj["@_url"] as string) ??
      (obj["#text"] as string) ??
      (obj["contentUrl"] as string) ??
      undefined
    );
  }
  return undefined;
}

/** BBC等の media:thumbnail からサムネイルURLを抽出 */
function extractMediaThumbnail(
  item: Record<string, unknown>
): string | undefined {
  const thumb =
    item["media:thumbnail"] ?? item["media:content"];
  if (!thumb) return undefined;

  if (typeof thumb === "object" && thumb !== null) {
    const obj = thumb as Record<string, unknown>;
    return (obj["@_url"] as string) ?? undefined;
  }
  return undefined;
}

/** サーバーサイド用HTMLタグ除去 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
