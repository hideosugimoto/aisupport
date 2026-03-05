import { XMLParser } from "fast-xml-parser";
import type { Logger } from "../logger/types";
import type { FeedArticleData, FeedSource } from "./types";
import { isPublicUrl } from "./url-utils";
import feedConfig from "../../../config/feed.json";

type SourceConfig = { enabled: boolean; lang: string; label: string; max_articles: number; host: string };
const sources = feedConfig.sources as Record<string, SourceConfig>;

/** RSSフェッチの同時リクエスト上限 */
const RSS_CONCURRENCY = 5;

/** RSSフェッチ先として許可するホスト（feed.jsonから自動構築） */
const ALLOWED_RSS_HOSTS = new Set(
  Object.values(sources).map((s) => s.host)
);

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
    const tasks: (() => Promise<FeedArticleData[]>)[] = [];

    // 日本語ソース
    if (sources.google_news?.enabled) {
      tasks.push(() => this.fetchGoogleNews(keyword, "news"));
      tasks.push(() => this.fetchGoogleNews(`${keyword} ブログ コラム`, "blog", keyword));
    }
    if (sources.bing_news_jp?.enabled) {
      tasks.push(() => this.fetchBingNews(keyword, "ja", "bing_news_jp"));
    }

    // 英語ソース（翻訳キーワードがある場合のみ）
    if (keywordEn) {
      if (sources.bing_news_en?.enabled) {
        tasks.push(() => this.fetchBingNews(keywordEn, "en", "bing_news_en", keyword));
      }
      if (sources.hacker_news?.enabled) {
        tasks.push(() => this.fetchHackerNews(keywordEn, keyword));
      }
    }

    return this.runWithConcurrency(tasks);
  }

  /**
   * カテゴリ固定フィード（Yahoo, BBC, TechCrunch）を取得
   * keywordは `__category_{source}` 形式で設定
   */
  async fetchCategoryFeeds(): Promise<FeedArticleData[]> {
    const tasks: (() => Promise<FeedArticleData[]>)[] = [];

    if (sources.yahoo_news_jp?.enabled) {
      tasks.push(() => this.fetchYahooNews());
    }
    if (sources.bbc_news?.enabled) {
      tasks.push(() => this.fetchBbcNews());
    }
    if (sources.techcrunch?.enabled) {
      tasks.push(() => this.fetchTechCrunch());
    }

    return this.runWithConcurrency(tasks);
  }

  /**
   * OGP取得が必要な記事かどうかを判定
   * RSS内で画像が取得できないソースが対象
   */
  static needsOgpFetch(article: FeedArticleData): boolean {
    if (article.imageUrl) return false;
    const ogpSources: FeedSource[] = ["yahoo_news_jp", "techcrunch"];
    return ogpSources.includes(article.source);
  }

  // ─── 並列度制限ヘルパー ────────────────────────

  /**
   * タスクをRSS_CONCURRENCY単位でバッチ実行し、結果をフラット化
   */
  private async runWithConcurrency(
    taskFns: (() => Promise<FeedArticleData[]>)[]
  ): Promise<FeedArticleData[]> {
    const batchResults: FeedArticleData[][] = [];

    for (let i = 0; i < taskFns.length; i += RSS_CONCURRENCY) {
      const batch = taskFns.slice(i, i + RSS_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((fn) => fn()));
      const fulfilled = results
        .filter((r): r is PromiseFulfilledResult<FeedArticleData[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);
      batchResults.push(fulfilled);
    }

    return batchResults.flat();
  }

  /** ソース別のmax_articlesを取得（設定がなければfeedConfigのデフォルト値） */
  private getMaxArticles(source: string): number {
    return sources[source]?.max_articles ?? feedConfig.max_articles_per_source;
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

    return items.slice(0, this.getMaxArticles("google_news")).map((item) => ({
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

    return items.slice(0, this.getMaxArticles(source)).map((item) => ({
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

    return items.slice(0, this.getMaxArticles("yahoo_news_jp")).map((item) => ({
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

    return items.slice(0, this.getMaxArticles("bbc_news")).map((item) => ({
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

    return items.slice(0, this.getMaxArticles("techcrunch")).map((item) => ({
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
    const maxArticles = this.getMaxArticles("hacker_news");
    const url = `https://hnrss.org/newest?q=${encodeURIComponent(query)}&count=${maxArticles}`;
    const items = await this.fetchAndParseRss(url, "hacker_news");
    if (!items) return [];

    return items.slice(0, maxArticles).map((item) => ({
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
    // S-1: RSSフェッチ先のホスト許可リストチェック
    try {
      const parsed = new URL(url);
      if (!ALLOWED_RSS_HOSTS.has(parsed.hostname)) {
        this.logger.warn("RSS fetch blocked: host not allowed", { source, hostname: parsed.hostname });
        return null;
      }
    } catch {
      this.logger.warn("RSS fetch blocked: invalid URL", { source, url });
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      feedConfig.fetch_timeout_ms
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
      });

      if (!response.ok) {
        this.logger.warn("RSS fetch failed", { source, status: response.status });
        return null;
      }

      const xml = await response.text();
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
        return entries.map((entry: Record<string, unknown>) => ({
          title: entry.title,
          link:
            typeof entry.link === "string"
              ? entry.link
              : typeof entry.link === "object" && entry.link !== null
                ? (entry.link as Record<string, string>)["@_href"] ?? ""
                : "",
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
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ─── ユーティリティ関数 ────────────────────────

/** BingリダイレクトURLから実URLを抽出 */
export function extractBingUrl(bingUrl: string): string {
  try {
    // XMLパーサーが &amp; をデコードしない場合があるため正規化
    const normalized = bingUrl.replaceAll("&amp;", "&");
    const urlObj = new URL(normalized);
    const extracted = urlObj.searchParams.get("url") ?? urlObj.searchParams.get("r") ?? normalized;
    // S-1: 抽出したURLの安全性検証
    return isPublicUrl(extracted) ? extracted : bingUrl;
  } catch {
    return bingUrl;
  }
}

/** Bing RSS の News:Image からサムネイルURLを抽出 */
function extractBingImage(item: Record<string, unknown>): string | undefined {
  const imageNode =
    item["News:Image"] ?? item["news:Image"] ?? item["News:image"];
  if (!imageNode) return undefined;

  if (typeof imageNode === "string") return imageNode;
  if (typeof imageNode === "object" && imageNode !== null) {
    const obj = imageNode as Record<string, unknown>;
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
