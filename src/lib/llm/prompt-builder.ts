import { readFileSync } from "fs";
import { join } from "path";
import type { Message } from "./types";
import featuresConfig from "../../../config/features.json";

const PROMPTS_DIR = join(process.cwd(), "prompts");
const templateCache = new Map<string, string>();

/**
 * Load a prompt template file
 * @param type - Template type (e.g., "task-decision", "task-breakdown")
 * @param name - Template name (e.g., "system.md", "user-template.md")
 * @param version - Optional version (e.g., "v2"). If specified, loads from {type}/{version}/{name}
 * @returns Template content as string
 */
export function loadTemplate(type: string, name: string, version?: string): string {
  const relativePath = version
    ? `${type}/${version}/${name}`
    : `${type}/${name}`;

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

function sanitizePromptInput(text: string): string {
  return text
    .replace(/```/g, "")
    .replace(/system\s*:/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/?s>/gi, "")
    .trim();
}

export interface TaskDecisionInput {
  tasks: string[];
  availableTime: number;
  energyLevel: number;
}

export function buildTaskDecisionMessages(
  input: TaskDecisionInput,
  version?: string,
  ragContext?: string
): Message[] {
  const evaluationAxes = loadTemplate("shared", "evaluation-axes.md");
  const systemTemplate = loadTemplate("task-decision", "system.md", version);
  const userTemplate = loadTemplate("task-decision", "user-template.md", version);

  const isAnxietyMode =
    input.energyLevel <= featuresConfig.anxiety_mode_threshold;

  let systemPrompt = replaceVariables(systemTemplate, {
    evaluation_axes: evaluationAxes,
  });

  if (isAnxietyMode) {
    const anxietyTemplate = loadTemplate("task-decision", "anxiety-mode.md", version);
    systemPrompt += "\n\n" + anxietyTemplate;
  }

  if (ragContext) {
    systemPrompt += "\n\n" + ragContext;
  }

  const tasksFormatted = input.tasks
    .map((t, i) => `${i + 1}. ${sanitizePromptInput(t)}`)
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

export interface TaskBreakdownInput {
  task: string;
  availableTime: number;
  energyLevel: number;
}

export function buildTaskBreakdownMessages(
  input: TaskBreakdownInput,
  version?: string
): Message[] {
  const systemTemplate = loadTemplate("task-breakdown", "system.md", version);
  const userTemplate = loadTemplate("task-breakdown", "user-template.md", version);

  const isAnxietyMode =
    input.energyLevel <= featuresConfig.anxiety_mode_threshold;

  let systemPrompt = systemTemplate;

  if (isAnxietyMode) {
    const anxietyTemplate = loadTemplate("task-breakdown", "anxiety-mode.md", version);
    systemPrompt += "\n\n" + anxietyTemplate;
  }

  const userPrompt = replaceVariables(userTemplate, {
    task: sanitizePromptInput(input.task),
    available_time: String(input.availableTime),
    energy_level: String(input.energyLevel),
  });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

const ALL_TEMPLATES = [
  { type: "shared", name: "evaluation-axes.md" },
  { type: "task-decision", name: "system.md" },
  { type: "task-decision", name: "user-template.md" },
  { type: "task-decision", name: "anxiety-mode.md" },
  { type: "task-breakdown", name: "system.md" },
  { type: "task-breakdown", name: "user-template.md" },
  { type: "task-breakdown", name: "anxiety-mode.md" },
];

export function preloadTemplates(): void {
  for (const { type, name } of ALL_TEMPLATES) {
    loadTemplate(type, name);
  }
}
