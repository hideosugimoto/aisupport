import type { LLMClient } from "../llm/types";
import type { Logger } from "../logger/types";
import { loadTemplate, sanitizePromptInput } from "../llm/prompt-builder";
import feedConfig from "../../../config/feed.json";

export interface CompassItemInput {
  title: string;
  content: string;
}

export class KeywordGenerator {
  constructor(
    private readonly llmClient: LLMClient,
    private readonly model: string,
    private readonly logger: Logger
  ) {}

  async generate(compassItems: CompassItemInput[]): Promise<string[]> {
    if (compassItems.length === 0) {
      this.logger.info("No compass items, skipping keyword generation");
      return [];
    }

    try {
      const itemsText = compassItems
        .map((item) => `- ${sanitizePromptInput(item.title)}: ${sanitizePromptInput(item.content).slice(0, 500)}`)
        .join("\n");

      const template = loadTemplate("feed", "generate-keywords.md");
      const prompt = template.replaceAll("{{compass_items}}", itemsText);

      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
      });

      let jsonText = response.content.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) || !parsed.every((k) => typeof k === "string")) {
        this.logger.warn("Invalid keyword response format", { raw: JSON.stringify(parsed).slice(0, 300) });
        return [];
      }

      return parsed.slice(0, feedConfig.max_keywords);
    } catch (error) {
      this.logger.warn("Keyword generation failed", { message: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}
