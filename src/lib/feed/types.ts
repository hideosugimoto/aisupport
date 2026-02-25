import feedConfig from "../../../config/feed.json";

export const FEED_SOURCES = [
  "bing_news_jp",
  "google_news",
  "yahoo_news_jp",
  "bing_news_en",
  "bbc_news",
  "techcrunch",
  "hacker_news",
] as const;

export type FeedSource = (typeof FEED_SOURCES)[number];

// feed.json を Single Source of Truth としてラベルを生成
export const SOURCE_LABELS: Record<FeedSource, string> = Object.fromEntries(
  FEED_SOURCES.map((id) => [
    id,
    (feedConfig.sources as Record<string, { label: string }>)[id]?.label ?? id,
  ])
) as Record<FeedSource, string>;

export interface FeedArticleData {
  title: string;
  url: string;
  source: FeedSource;
  category: "news" | "blog";
  snippet: string;
  publishedAt: Date;
  keyword: string;
  imageUrl?: string;
}

export interface GeneratedKeywords {
  keywords: string[];
}
