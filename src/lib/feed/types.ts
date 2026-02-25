export interface FeedArticleData {
  title: string;
  url: string;
  source: string;
  category: "news" | "blog";
  snippet: string;
  publishedAt: Date;
  keyword: string;
  imageUrl?: string;
}

export interface GeneratedKeywords {
  keywords: string[];
}
