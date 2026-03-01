import { readFile } from "fs/promises";
import { join } from "path";
import { sanitizePromptInput } from "../llm/prompt-builder";
import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import type { FeedArticleData } from "./types";

let promptCache: string | null = null;

async function getPromptTemplate(): Promise<string> {
  if (promptCache) return promptCache;
  promptCache = await readFile(
    join(process.cwd(), "prompts/feed/filter-relevance.md"),
    "utf-8"
  );
  return promptCache;
}

interface RelevanceResult {
  index: number;
  relevant: boolean;
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
      const promptTemplate = await getPromptTemplate();

      const articlesText = articles
        .map(
          (a, i) =>
            `[${i}] ${sanitizePromptInput(a.title)} — ${sanitizePromptInput(a.snippet)}`
        )
        .join("\n");

      const prompt = promptTemplate
        .replace("{{keywords}}", keywords.map(sanitizePromptInput).join(", "))
        .replace("{{articles}}", articlesText);

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

      const relevantIndices = new Set<number>();
      for (const item of parsed) {
        const r = item as RelevanceResult;
        if (
          typeof r.index === "number" &&
          typeof r.relevant === "boolean" &&
          r.relevant
        ) {
          relevantIndices.add(r.index);
        }
      }

      const filtered = articles.filter((_, i) => relevantIndices.has(i));

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
