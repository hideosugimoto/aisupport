import { readFileSync } from "fs";
import { join, resolve, sep } from "path";
import type { Message } from "./types";
import featuresConfig from "../../../config/features.json";

const PROMPTS_DIR = resolve(join(process.cwd(), "prompts"));
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

  try {
    const fullPath = resolve(join(PROMPTS_DIR, relativePath));
    if (!fullPath.startsWith(PROMPTS_DIR + sep)) {
      throw new Error(`パス "${relativePath}" がプロンプトディレクトリの外部を参照しています`);
    }
    const content = readFileSync(fullPath, "utf-8");
    templateCache.set(relativePath, content);
    return content;
  } catch (error) {
    throw new Error(
      `プロンプトテンプレート "${relativePath}" の読み込みに失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function sanitizePromptInput(text: string): string {
  return text
    .replace(/```/g, "")
    .replace(/system\s*:/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<\/?s>/gi, "")
    .trim();
}

function truncateContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n...（省略）";
}

export interface TaskDecisionInput {
  tasks: string[];
  availableTime: number;
  energyLevel: number;
}

const MAX_CONTEXT_CHARS = 4000; // 約1000トークン相当

export function buildTaskDecisionMessages(
  input: TaskDecisionInput,
  version?: string,
  ragContext?: string,
  compassContext?: string
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

  if (compassContext) {
    systemPrompt += "\n\n" + truncateContext(compassContext, MAX_CONTEXT_CHARS);
  }

  if (ragContext) {
    systemPrompt += "\n\n" + truncateContext(ragContext, MAX_CONTEXT_CHARS);
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
