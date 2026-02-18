import type { NeglectDetector } from "./neglect-detector";
import type { LLMClient } from "../llm/types";
import { loadTemplate, sanitizePromptInput } from "../llm/prompt-builder";

export interface CompassSuggestion {
  compassItemId: number;
  compassTitle: string;
  suggestedTask: string;
  reason: string;
  timeEstimate: number;
}

export interface CompassSuggesterInput {
  tasks: string[];
  timeMinutes: number;
  energyLevel: number;
}

function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export class CompassSuggester {
  constructor(
    private readonly neglectDetector: NeglectDetector,
    private readonly llmClient: LLMClient,
    private readonly model: string
  ) {}

  async suggest(
    userId: string,
    input: CompassSuggesterInput
  ): Promise<CompassSuggestion | null> {
    try {
      // Step 1: Join tasks to create query string (W4: sanitize for vector search)
      const query = input.tasks.map((t) => sanitizePromptInput(t)).join(" ");

      // Step 2: Detect the most neglected compass item
      const neglected = await this.neglectDetector.detect(userId, query);
      if (neglected === null) {
        return null;
      }

      // Step 3: Load prompt template
      const template = loadTemplate("compass", "suggest-action.md");

      // Step 4: Replace variables in the template (sanitize user-controlled data)
      const filledPrompt = replaceVariables(template, {
        compass_title: sanitizePromptInput(neglected.title).slice(0, 200),
        compass_content: sanitizePromptInput(neglected.content).slice(0, 4000),
        available_time: String(input.timeMinutes),
        energy_level: String(input.energyLevel),
      });

      // Step 5: Call LLM (non-streaming)
      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: filledPrompt }],
      });

      // Step 6: Parse and validate JSON response (W2: strict number check, W5: length limits)
      const raw = JSON.parse(response.content);
      if (
        typeof raw?.suggestedTask !== "string" ||
        typeof raw?.reason !== "string" ||
        typeof raw?.timeEstimate !== "number" ||
        !Number.isFinite(raw.timeEstimate) ||
        raw.timeEstimate <= 0 ||
        raw.timeEstimate > 1440
      ) {
        return null;
      }

      // Step 7: Return CompassSuggestion (truncate LLM output to safe limits)
      return {
        compassItemId: neglected.compassItemId,
        compassTitle: neglected.title,
        suggestedTask: String(raw.suggestedTask).slice(0, 500),
        reason: String(raw.reason).slice(0, 1000),
        timeEstimate: raw.timeEstimate,
      };
    } catch {
      // Step 8: Any error → return null to avoid blocking main flow
      return null;
    }
  }
}
