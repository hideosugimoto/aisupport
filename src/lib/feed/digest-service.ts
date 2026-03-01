import { prisma } from "../db/prisma";
import { resolveApiKey } from "../billing/key-resolver";
import { createLLMClient } from "../llm/client-factory";
import { loadTemplate, sanitizePromptInput } from "../llm/prompt-builder";
import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import type { EmailService } from "../email/email-service";
import feedConfig from "../../../config/feed.json";

interface DigestArticle {
  title: string;
  url: string;
  source: string;
  category: string;
  snippet: string;
  lang: string;
}

interface SummarizedArticle {
  title_ja: string;
  summary: string;
  url: string;
  source: string;
  category: string;
}

export interface DigestResult {
  userId: string;
  articlesCount: number;
  emailSent: boolean;
  error?: string;
}

export class DigestService {
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: Logger
  ) {}

  async generateAndSendDigest(
    userId: string,
    userEmail: string
  ): Promise<DigestResult> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const articles = await prisma.feedArticle.findMany({
      where: {
        userId,
        fetchedAt: { gte: cutoff },
      },
      orderBy: { publishedAt: "desc" },
      take: feedConfig.digest_max_articles,
    });

    if (articles.length === 0) {
      this.logger.info("No articles for digest", { userId });
      return { userId, articlesCount: 0, emailSent: false };
    }

    const digestArticles: DigestArticle[] = articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      category: a.category,
      snippet: a.snippet,
      lang: this.getSourceLang(a.source),
    }));

    const summarized = await this.summarizeArticles(userId, digestArticles);

    const today = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = this.buildEmailHtml(summarized, articles.length, today);

    const result = await this.emailService.sendEmail({
      to: userEmail,
      subject: `デイリーダイジェスト - ${today}（${articles.length}件）`,
      html,
    });

    this.logger.info("Digest result", {
      userId,
      articles: articles.length,
      sent: result.success,
    });

    return {
      userId,
      articlesCount: articles.length,
      emailSent: result.success,
      error: result.success ? undefined : "Email send failed",
    };
  }

  private getSourceLang(source: string): string {
    const sources = feedConfig.sources as Record<string, { lang: string }>;
    return sources[source]?.lang ?? "ja";
  }

  private async summarizeArticles(
    userId: string,
    articles: DigestArticle[]
  ): Promise<SummarizedArticle[]> {
    const { apiKey } = await resolveApiKey(userId, "openai", this.logger);
    const llmClient = createLLMClient("openai", undefined, false, apiKey);
    const template = loadTemplate("feed", "digest-summary.md");

    const batchSize = feedConfig.digest_batch_size;
    const results: SummarizedArticle[] = [];

    // シリアル実行: OpenAI APIレート制限を考慮
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      const batchResult = await this.summarizeBatch(llmClient, batch, template);
      results.push(...batchResult);
    }

    return results;
  }

  private async summarizeBatch(
    llmClient: LLMClient,
    batch: DigestArticle[],
    template: string
  ): Promise<SummarizedArticle[]> {
    const articlesInput = batch.map((a, idx) => ({
      index: idx,
      title: sanitizePromptInput(a.title),
      snippet: sanitizePromptInput(a.snippet).slice(0, 500),
      lang: a.lang,
    }));

    const prompt = template.replaceAll(
      "{{articles}}",
      JSON.stringify(articlesInput, null, 2)
    );

    try {
      const response = await llmClient.chat({
        model: feedConfig.digest_model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn("Digest summary: no JSON array in response");
        return this.fallbackSummaries(batch);
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return this.fallbackSummaries(batch);
      }

      return batch.map((article, idx) => {
        const llmResult = parsed.find(
          (r: { index?: number }) => r.index === idx
        ) as Record<string, unknown> | undefined;

        const title_ja =
          typeof llmResult?.title_ja === "string"
            ? llmResult.title_ja
            : article.title;
        const summary =
          typeof llmResult?.summary === "string"
            ? llmResult.summary
            : article.snippet;

        return {
          title_ja,
          summary,
          url: article.url,
          source: article.source,
          category: article.category,
        };
      });
    } catch (error) {
      this.logger.warn("Digest summarization failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackSummaries(batch);
    }
  }

  private fallbackSummaries(batch: DigestArticle[]): SummarizedArticle[] {
    return batch.map((a) => ({
      title_ja: a.title,
      summary: a.snippet,
      url: a.url,
      source: a.source,
      category: a.category,
    }));
  }

  private buildEmailHtml(
    articles: SummarizedArticle[],
    totalCount: number,
    dateStr: string
  ): string {
    const news = articles.filter((a) => a.category === "news");
    const blogs = articles.filter((a) => a.category === "blog");

    const renderSection = (title: string, items: SummarizedArticle[]): string => {
      if (items.length === 0) return "";
      const rows = items
        .map(
          (a) => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #e4e4e7;">
            <a href="${this.escapeHtml(this.sanitizeUrl(a.url))}" style="color: #18181b; text-decoration: none; font-size: 15px; font-weight: 600; line-height: 1.5;" target="_blank">
              ${this.escapeHtml(a.title_ja)}
            </a>
            <div style="margin-top: 4px; font-size: 12px; color: #71717a;">
              ${this.escapeHtml(this.getSourceLabel(a.source))}
            </div>
            <div style="margin-top: 8px; font-size: 14px; color: #3f3f46; line-height: 1.7; white-space: pre-line;">${this.escapeHtml(a.summary)}</div>
          </td>
        </tr>`
        )
        .join("\n");

      return `
      <tr>
        <td style="padding: 20px 0 8px 0;">
          <h2 style="margin: 0; font-size: 16px; color: #18181b; border-left: 4px solid #3b82f6; padding-left: 12px;">
            ${title}（${items.length}件）
          </h2>
        </td>
      </tr>
      ${rows}`;
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="font-size: 20px; color: #18181b; margin: 0 0 4px 0;">
        デイリーダイジェスト
      </h1>
      <p style="font-size: 13px; color: #71717a; margin: 0 0 16px 0;">
        ${this.escapeHtml(dateStr)} / ${totalCount}件の記事
      </p>
      <table style="width: 100%; border-collapse: collapse;">
        ${renderSection("ニュース", news)}
        ${renderSection("ブログ・コラム", blogs)}
      </table>
    </div>
    <div style="margin-top: 16px; text-align: center;">
      <p style="font-size: 12px; color: #a1a1aa;">
        <a href="${appUrl}/feed" style="color: #3b82f6; text-decoration: none;">フィードを開く</a>
        &nbsp;|&nbsp;
        <a href="${appUrl}/settings" style="color: #71717a; text-decoration: none;">配信停止</a>
      </p>
      <p style="font-size: 11px; color: #d4d4d8; margin-top: 8px;">
        AI Support デイリーダイジェスト
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  private getSourceLabel(source: string): string {
    const sources = feedConfig.sources as Record<string, { label: string }>;
    return sources[source]?.label ?? source;
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "#";
      }
      return url;
    } catch {
      return "#";
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
