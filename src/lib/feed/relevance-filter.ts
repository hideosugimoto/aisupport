import { sanitizePromptInput, loadTemplate, replaceVariables } from "../llm/prompt-builder";
import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import type { FeedArticleData } from "./types";

interface RelevanceResult {
  index: number;
  relevant: boolean;
  matched_keyword?: string | null;
}

export class RelevanceFilter {
  constructor(
    private readonly llmClient: LLMClient,
    private readonly model: string,
    private readonly logger: Logger
  ) {}

  async filterArticles(
    articles: FeedArticleData[],
    keywords: string[]
  ): Promise<FeedArticleData[]> {
    if (articles.length === 0 || keywords.length === 0) return articles;

    try {
      const promptTemplate = loadTemplate("feed", "filter-relevance.md");

      const articlesText = articles
        .map(
          (a, i) =>
            `[${i}] ${sanitizePromptInput(a.title)} — ${sanitizePromptInput(a.snippet)}`
        )
        .join("\n");

      const prompt = replaceVariables(promptTemplate, {
        keywords: keywords.map(sanitizePromptInput).join(", "),
        articles: articlesText,
      });

      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn("Relevance filter response has no JSON array", {
          content: response.content.slice(0, 200),
        });
        return articles;
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        this.logger.warn("Relevance filter response is not an array");
        return articles;
      }

      const relevantMap = new Map<number, string | null>();
      for (const item of parsed) {
        const r = item as RelevanceResult;
        if (
          typeof r.index === "number" &&
          typeof r.relevant === "boolean" &&
          r.relevant
        ) {
          relevantMap.set(
            r.index,
            typeof r.matched_keyword === "string" ? r.matched_keyword : null
          );
        }
      }

      const filtered: FeedArticleData[] = [];
      for (let i = 0; i < articles.length; i++) {
        if (!relevantMap.has(i)) continue;
        const matchedKeyword = relevantMap.get(i);
        if (matchedKeyword && articles[i].keyword.startsWith("__category_")) {
          filtered.push({ ...articles[i], keyword: matchedKeyword });
        } else {
          filtered.push(articles[i]);
        }
      }

      this.logger.info("Category articles filtered by relevance", {
        input: articles.length,
        output: filtered.length,
      });

      return filtered;
    } catch (error) {
      this.logger.warn("Relevance filter failed, passing all articles", {
        message: error instanceof Error ? error.message : String(error),
      });
      return articles;
    }
  }
}
