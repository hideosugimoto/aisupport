import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLLMClient } from "@/lib/llm/client-factory";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "./news-fetcher";
import { OgpFetcher } from "./ogp-fetcher";
import { KeywordTranslator } from "./keyword-translator";
import feedConfig from "../../../config/feed.json";
import type { FeedArticleData } from "./types";
import type { Logger } from "../logger/types";

export interface RefreshResult {
  newCount: number;
}

export class FeedRefreshService {
  private readonly fetcher: NewsFetcher;
  private readonly ogpFetcher: OgpFetcher;

  constructor(private readonly logger: Logger) {
    this.fetcher = new NewsFetcher(logger.child("fetcher"));
    this.ogpFetcher = new OgpFetcher(logger.child("ogp"));
  }

  /**
   * 単一ユーザーのフィードを更新（refresh route用）
   */
  async refreshForUser(userId: string, keywords: string[]): Promise<RefreshResult> {
    const { articles, translationMap } = await this.fetchAllArticles(
      userId,
      keywords
    );

    // Phase 2: 英語キーワードでの再検索
    const enArticles = await this.fetchEnglishArticles(keywords, translationMap);
    const allArticles = [...articles, ...enArticles];

    const newCount = await this.saveArticles(userId, allArticles);
    return { newCount };
  }

  /**
   * 単一ユーザーのフィードを更新（cron用：カテゴリフィードを外部から受け取る）
   */
  async refreshForUserWithCategory(
    userId: string,
    keywords: string[],
    categoryArticles: FeedArticleData[]
  ): Promise<RefreshResult> {
    const { articles: jpArticles, translationMap } = await this.fetchKeywordArticles(
      userId,
      keywords
    );

    const enArticles = await this.fetchEnglishArticles(keywords, translationMap);
    const allArticles = [...jpArticles, ...categoryArticles, ...enArticles];

    if (allArticles.length === 0) return { newCount: 0 };

    const newCount = await this.saveArticles(userId, allArticles);
    return { newCount };
  }

  /**
   * カテゴリフィードを取得（ユーザー非依存なので外部で1回だけ呼ぶ）
   */
  async fetchCategoryFeeds(): Promise<FeedArticleData[]> {
    return this.fetcher.fetchCategoryFeeds();
  }

  // ─── 内部メソッド ────────────────────────

  /**
   * Phase 1: 日本語ソース + カテゴリフィード + キーワード翻訳を並列実行
   */
  private async fetchAllArticles(
    userId: string,
    keywords: string[]
  ): Promise<{ articles: FeedArticleData[]; translationMap: Map<string, string> }> {
    let translationMap = new Map<string, string>();
    const [jpResults, categoryArticles] = await Promise.all([
      Promise.allSettled(
        keywords.map((kw) => this.fetcher.fetchByKeyword(kw))
      ),
      this.fetcher.fetchCategoryFeeds(),
      this.translateKeywords(userId, keywords).then((m) => { translationMap = m; }),
    ]);

    const jpArticles = this.flattenResults(jpResults);
    return { articles: [...jpArticles, ...categoryArticles], translationMap };
  }

  /**
   * Phase 1 (cron向け): キーワード検索 + 翻訳のみ（カテゴリなし）
   */
  private async fetchKeywordArticles(
    userId: string,
    keywords: string[]
  ): Promise<{ articles: FeedArticleData[]; translationMap: Map<string, string> }> {
    let translationMap = new Map<string, string>();
    const [jpResults] = await Promise.all([
      Promise.allSettled(
        keywords.map((kw) => this.fetcher.fetchByKeyword(kw))
      ),
      this.translateKeywords(userId, keywords).then((m) => { translationMap = m; }),
    ]);

    return { articles: this.flattenResults(jpResults), translationMap };
  }

  /**
   * Phase 2: 英語キーワードでの再検索
   */
  private async fetchEnglishArticles(
    keywords: string[],
    translationMap: Map<string, string>
  ): Promise<FeedArticleData[]> {
    if (translationMap.size === 0) return [];

    const enResults = await Promise.allSettled(
      keywords.map((kw) => {
        const enKw = translationMap.get(kw);
        if (!enKw) return Promise.resolve([]);
        return this.fetcher.fetchByKeyword(kw, enKw);
      })
    );
    return this.flattenResults(enResults);
  }

  /**
   * キーワード翻訳（失敗時は空Map）
   */
  private async translateKeywords(
    userId: string,
    keywords: string[]
  ): Promise<Map<string, string>> {
    try {
      const { apiKey } = await resolveApiKey(userId, "openai");
      const llmClient = createLLMClient("openai", undefined, false, apiKey);
      const translator = new KeywordTranslator(
        llmClient,
        feedConfig.keyword_model,
        this.logger.child("translator")
      );
      return await translator.translate(keywords);
    } catch (error) {
      this.logger.warn("Translation skipped", {
        message: error instanceof Error ? error.message : String(error),
      });
      return new Map();
    }
  }

  /**
   * OGP取得 + DB保存
   */
  private async saveArticles(
    userId: string,
    allArticles: FeedArticleData[]
  ): Promise<number> {
    const ogpTargets = allArticles.filter(NewsFetcher.needsOgpFetch);
    const imageMap = ogpTargets.length > 0
      ? await this.ogpFetcher.fetchImageUrls(ogpTargets)
      : new Map<string, string>();

    const { count } = await prisma.feedArticle.createMany({
      data: allArticles.map((article) => ({
        userId,
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        snippet: article.snippet,
        publishedAt: article.publishedAt,
        keyword: article.keyword,
        imageUrl: article.imageUrl ?? imageMap.get(article.url),
      })),
      skipDuplicates: true,
    });

    return count;
  }

  private flattenResults(
    results: PromiseSettledResult<FeedArticleData[]>[]
  ): FeedArticleData[] {
    return results
      .filter(
        (r): r is PromiseFulfilledResult<FeedArticleData[]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value);
  }
}
