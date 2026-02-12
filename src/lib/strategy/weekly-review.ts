import type { LLMClient, Message, TokenUsage } from "../llm/types";
import type { TaskDecisionRepository } from "../db/types";
import { readFileSync } from "fs";
import { join } from "path";

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

export interface WeeklyReviewResult {
  review: string;
  decisionsCount: number;
  periodStart: Date;
  periodEnd: Date;
  usage: TokenUsage;
  costUsd: number;
}

export interface WeeklyReviewEngine {
  generateReview(provider?: string): Promise<WeeklyReviewResult>;
}

export class DefaultWeeklyReviewEngine implements WeeklyReviewEngine {
  constructor(
    private llmClient: LLMClient,
    private repository: TaskDecisionRepository
  ) {}

  async generateReview(provider = "openai"): Promise<WeeklyReviewResult> {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 7);

    const decisions = await this.repository.findByDateRange(
      periodStart,
      periodEnd
    );

    const decisionsSummary = this.formatDecisionsSummary(decisions);

    const systemPrompt = loadTemplate("weekly-review/system.md");
    const userTemplate = loadTemplate("weekly-review/user-template.md");

    const userPrompt = replaceVariables(userTemplate, {
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      total_count: String(decisions.length),
      decisions_summary: decisionsSummary,
    });

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await this.llmClient.chat({
      model: this.getModelForProvider(provider),
      messages,
      temperature: 0.5,
      maxTokens: 2000,
    });

    const costUsd = this.calculateCost(response.usage, provider);

    return {
      review: response.content,
      decisionsCount: decisions.length,
      periodStart,
      periodEnd,
      usage: response.usage,
      costUsd,
    };
  }

  private formatDecisionsSummary(
    decisions: Array<{
      tasksInput: string;
      energyLevel: number;
      availableTime: number;
      provider: string;
      result: string;
      createdAt: Date;
    }>
  ): string {
    if (decisions.length === 0) {
      return "（この期間に判定履歴はありません）";
    }

    return decisions
      .map((d, i) => {
        const tasks = JSON.parse(d.tasksInput);
        const taskList = tasks.map((t: string, idx: number) => `  ${idx + 1}. ${t}`).join("\n");
        const date = d.createdAt.toISOString().split("T")[0];

        return `
#### ${i + 1}. ${date} (${d.provider})
- エネルギー: ${d.energyLevel}/5
- 利用可能時間: ${d.availableTime}分
- タスク候補:
${taskList}
- 判定結果:
${d.result.split("\n").slice(0, 5).join("\n")}
`;
      })
      .join("\n");
  }

  private getModelForProvider(provider: string): string {
    const modelMap: Record<string, string> = {
      openai: "gpt-4o-mini",
      gemini: "gemini-2.0-flash-exp",
      claude: "claude-3-5-sonnet-20241022",
    };
    return modelMap[provider] || "gpt-4o-mini";
  }

  private calculateCost(usage: TokenUsage, provider: string): number {
    const costPerMillion: Record<
      string,
      { input: number; output: number }
    > = {
      openai: { input: 0.15, output: 0.6 },
      gemini: { input: 0.0, output: 0.0 },
      claude: { input: 3.0, output: 15.0 },
    };

    const rates = costPerMillion[provider] || costPerMillion.openai;
    const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
    const outputCost = (usage.outputTokens / 1_000_000) * rates.output;

    return inputCost + outputCost;
  }
}
