import type { NeglectDetector } from "./neglect-detector";
import type { LLMClient } from "../llm/types";
import { loadTemplate } from "../llm/prompt-builder";

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
      // Step 1: Join tasks to create query string
      const query = input.tasks.join(" ");

      // Step 2: Detect the most neglected compass item
      const neglected = await this.neglectDetector.detect(userId, query);
      if (neglected === null) {
        return null;
      }

      // Step 3: Load prompt template
      const template = loadTemplate("compass", "suggest-action.md");

      // Step 4: Replace variables in the template
      const filledPrompt = replaceVariables(template, {
        compass_title: neglected.title,
        compass_content: neglected.content,
        available_time: String(input.timeMinutes),
        energy_level: String(input.energyLevel),
      });

      // Step 5: Call LLM (non-streaming)
      const response = await this.llmClient.chat({
        model: this.model,
        messages: [{ role: "user", content: filledPrompt }],
      });

      // Step 6: Parse JSON response
      const parsed = JSON.parse(response.content) as {
        suggestedTask: string;
        reason: string;
        timeEstimate: number;
      };

      // Step 7: Return CompassSuggestion
      return {
        compassItemId: neglected.compassItemId,
        compassTitle: neglected.title,
        suggestedTask: parsed.suggestedTask,
        reason: parsed.reason,
        timeEstimate: parsed.timeEstimate,
      };
    } catch {
      // Step 8: Any error → return null to avoid blocking main flow
      return null;
    }
  }
}
