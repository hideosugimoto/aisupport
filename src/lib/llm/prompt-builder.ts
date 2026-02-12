import { readFileSync } from "fs";
import { join } from "path";
import type { Message } from "./types";
import featuresConfig from "../../../config/features.json";

const PROMPTS_DIR = join(process.cwd(), "prompts");
const templateCache = new Map<string, string>();

function loadTemplate(relativePath: string): string {
  const cached = templateCache.get(relativePath);
  if (cached !== undefined) {
    return cached;
  }

  const content = readFileSync(join(PROMPTS_DIR, relativePath), "utf-8");
  templateCache.set(relativePath, content);
  return content;
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

export interface TaskDecisionInput {
  tasks: string[];
  availableTime: number;
  energyLevel: number;
}

export function buildTaskDecisionMessages(
  input: TaskDecisionInput
): Message[] {
  const evaluationAxes = loadTemplate("shared/evaluation-axes.md");
  const systemTemplate = loadTemplate("task-decision/system.md");
  const userTemplate = loadTemplate("task-decision/user-template.md");

  const isAnxietyMode =
    input.energyLevel <= featuresConfig.anxiety_mode_threshold;

  let systemPrompt = replaceVariables(systemTemplate, {
    evaluation_axes: evaluationAxes,
  });

  if (isAnxietyMode) {
    const anxietyTemplate = loadTemplate("task-decision/anxiety-mode.md");
    systemPrompt += "\n\n" + anxietyTemplate;
  }

  const tasksFormatted = input.tasks
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const userPrompt = replaceVariables(userTemplate, {
    tasks: tasksFormatted,
    available_time: String(input.availableTime),
    energy_level: String(input.energyLevel),
  });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
