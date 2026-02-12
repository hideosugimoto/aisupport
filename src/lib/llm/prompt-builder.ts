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
  input: TaskBreakdownInput
): Message[] {
  const systemTemplate = loadTemplate("task-breakdown/system.md");
  const userTemplate = loadTemplate("task-breakdown/user-template.md");

  const isAnxietyMode =
    input.energyLevel <= featuresConfig.anxiety_mode_threshold;

  let systemPrompt = systemTemplate;

  if (isAnxietyMode) {
    const anxietyTemplate = loadTemplate("task-breakdown/anxiety-mode.md");
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
  "shared/evaluation-axes.md",
  "task-decision/system.md",
  "task-decision/user-template.md",
  "task-decision/anxiety-mode.md",
  "task-breakdown/system.md",
  "task-breakdown/user-template.md",
  "task-breakdown/anxiety-mode.md",
];

export function preloadTemplates(): void {
  for (const path of ALL_TEMPLATES) {
    loadTemplate(path);
  }
}
