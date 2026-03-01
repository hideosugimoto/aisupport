import { resolveApiKey } from "@/lib/billing/key-resolver";
import { createLLMClient } from "@/lib/llm/client-factory";
import { prisma } from "@/lib/db/prisma";
import { NewsFetcher } from "./news-fetcher";
import { OgpFetcher } from "./ogp-fetcher";
import { KeywordTranslator } from "./keyword-translator";
import { filterByKeywordRelevance } from "./article-filter";
import { RelevanceFilter } from "./relevance-filter";
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
    const { jpArticles, translationMap, categoryArticles } =
      await this.fetchPhase1(userId, keywords, true);

    const enArticles = await this.fetchEnglishArticles(keywords, translationMap);

    // D: キーワード記事に簡易マッチフィルタ
    const filteredJp = filterByKeywordRelevance(jpArticles, keywords);
    const filteredEn = filterByKeywordRelevance(enArticles, keywords);

    // A: カテゴリ記事にLLM関連性フィルタ
    const filteredCategory = await this.filterCategoryArticles(
      userId,
      categoryArticles,
      keywords
    );

    const allArticles = [...filteredJp, ...filteredCategory, ...filteredEn];

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
    const { jpArticles, translationMap } =
      await this.fetchPhase1(userId, keywords, false);

    const enArticles = await this.fetchEnglishArticles(keywords, translationMap);

    // D: キーワード記事に簡易マッチフィルタ
    const filteredJp = filterByKeywordRelevance(jpArticles, keywords);
    const filteredEn = filterByKeywordRelevance(enArticles, keywords);

    // A: カテゴリ記事にLLM関連性フィルタ
    const filteredCategory = await this.filterCategoryArticles(
      userId,
      categoryArticles,
      keywords
    );

    const allArticles = [...filteredJp, ...filteredCategory, ...filteredEn];

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
   * Phase 1: 日本語キーワード検索 + 翻訳を並列実行（カテゴリフィードはオプション）
   */
  private async fetchPhase1(
    userId: string,
    keywords: string[],
    includeCategory: boolean
  ): Promise<{
    jpArticles: FeedArticleData[];
    translationMap: Map<string, string>;
    categoryArticles: FeedArticleData[];
  }> {
    const tasks: [
      Promise<PromiseSettledResult<FeedArticleData[]>[]>,
      Promise<FeedArticleData[]>,
      Promise<Map<string, string>>,
    ] = [
      Promise.allSettled(
        keywords.map((kw) => this.fetcher.fetchByKeyword(kw))
      ),
      includeCategory ? this.fetcher.fetchCategoryFeeds() : Promise.resolve([]),
      this.translateKeywords(userId, keywords),
    ];

    const [jpResults, categoryArticles, translationMap] = await Promise.all(tasks);

    return {
      jpArticles: this.flattenResults(jpResults),
      translationMap,
      categoryArticles,
    };
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
   * カテゴリフィード記事にLLM関連性フィルタを適用（失敗時は全件通過）
   */
  private async filterCategoryArticles(
    userId: string,
    articles: FeedArticleData[],
    keywords: string[]
  ): Promise<FeedArticleData[]> {
    if (articles.length === 0) return articles;

    try {
      const { apiKey } = await resolveApiKey(userId, "openai");
      const llmClient = createLLMClient("openai", undefined, false, apiKey);
      const filter = new RelevanceFilter(
        llmClient,
        feedConfig.relevance_filter_model,
        this.logger.child("relevance-filter")
      );
      return await filter.filterArticles(articles, keywords);
    } catch (error) {
      this.logger.warn("Category relevance filter skipped", {
        message: error instanceof Error ? error.message : String(error),
      });
      return articles;
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
