import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import { loadTemplate, replaceVariables } from "../llm/prompt-builder";

const MAX_TRANSLATION_LENGTH = 200;

export class KeywordTranslator {
  constructor(
    private readonly llmClient: LLMClient,
    private readonly model: string,
    private readonly logger: Logger
  ) {}

  async translate(keywords: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (keywords.length === 0) return map;

    try {
      const promptTemplate = loadTemplate("feed", "translate-keywords.md");
      const prompt = replaceVariables(promptTemplate, {
        keywords: keywords.join(", "),
      });

      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn("Translation response has no JSON", {
          content: response.content.slice(0, 200),
        });
        return map;
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        this.logger.warn("Translation response is not an object");
        return map;
      }

      for (const [ja, en] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof en === "string" && en.trim() && en.length <= MAX_TRANSLATION_LENGTH) {
          map.set(ja, en.trim());
        }
      }

      this.logger.info("Keywords translated", {
        input: keywords.length,
        output: map.size,
      });
    } catch (error) {
      this.logger.error("Keyword translation failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      // Graceful degradation: 翻訳失敗時は日本語キーワードをそのまま使用
    }

    return map;
  }
}
