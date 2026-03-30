import type { LLMClient, Message, TokenUsage } from "../llm/types";
import type { TaskDecisionRepository } from "../db/types";
import type { Retriever } from "../rag/retriever";
import type { NeglectDetector } from "../compass/neglect-detector";
import { getDefaultModel } from "../config/types";
import { calculateCostUsd } from "../cost/pricing";
import { loadTemplate, replaceVariables } from "../llm/prompt-builder";

export interface WeeklyReviewResult {
  review: string;
  decisionsCount: number;
  periodStart: Date;
  periodEnd: Date;
  usage: TokenUsage;
  costUsd: number;
  compassContext?: {
    hasCompass: boolean;
    neglectedItem?: { title: string; similarity: number };
  };
}

export interface WeeklyReviewEngine {
  generateReview(userId: string, provider?: string): Promise<WeeklyReviewResult>;
}

export class DefaultWeeklyReviewEngine implements WeeklyReviewEngine {
  private compassRetriever?: Retriever;
  private neglectDetector?: NeglectDetector;

  constructor(
    private readonly llmClient: LLMClient,
    private readonly repository: TaskDecisionRepository
  ) {}

  setCompassRetriever(retriever: Retriever): void {
    this.compassRetriever = retriever;
  }

  setNeglectDetector(detector: NeglectDetector): void {
    this.neglectDetector = detector;
  }

  async generateReview(userId: string, provider = "openai"): Promise<WeeklyReviewResult> {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 7);

    const decisions = await this.repository.findByDateRange(
      userId,
      periodStart,
      periodEnd
    );

    const decisionsSummary = this.formatDecisionsSummary(decisions);
    const { summary: compassSummary, context: compassContextResult } =
      await this.fetchCompassContext(userId, decisions);

    const systemPrompt = loadTemplate("weekly-review", "system.md");
    const userTemplate = loadTemplate("weekly-review", "user-template.md");

    const userPrompt = replaceVariables(userTemplate, {
      period_start: periodStart.toISOString().split("T")[0],
      period_end: periodEnd.toISOString().split("T")[0],
      total_count: String(decisions.length),
      decisions_summary: decisionsSummary,
    }) + compassSummary;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const model = getDefaultModel(provider);

    const response = await this.llmClient.chat({
      model,
      messages,
      temperature: 0.5,
      maxTokens: 2000,
    });

    const costUsd = calculateCostUsd(provider, model, response.usage.inputTokens, response.usage.outputTokens);

    return {
      review: response.content,
      decisionsCount: decisions.length,
      periodStart,
      periodEnd,
      usage: response.usage,
      costUsd,
      compassContext: compassContextResult,
    };
  }

  private async fetchCompassContext(
    userId: string,
    decisions: Array<{ tasksInput: string }>
  ): Promise<{ summary: string; context?: WeeklyReviewResult["compassContext"] }> {
    if (!this.compassRetriever && !this.neglectDetector) {
      return { summary: "" };
    }

    try {
      const taskQuery = decisions
        .flatMap(d => {
          try { return JSON.parse(d.tasksInput); } catch { return []; }
        })
        .filter((t): t is string => typeof t === "string")
        .join(" ");

      if (!taskQuery) {
        return { summary: "" };
      }

      let summary = "";
      let context: WeeklyReviewResult["compassContext"];

      if (this.compassRetriever) {
        const compassResult = await this.compassRetriever.retrieve(userId, taskQuery);
        if (compassResult.contextText) {
          summary += "\n\n## 羅針盤（目標・価値観）との照合\n" +
            "以下はユーザーが登録した羅針盤のうち、今週の判断に関連するものです。\n" +
            "この週の判断が羅針盤とどの程度整合していたかを分析してください。\n\n" +
            compassResult.contextText;
          context = { hasCompass: true };
        }
      }

      if (this.neglectDetector) {
        const neglected = await this.neglectDetector.detect(userId, taskQuery);
        if (neglected) {
          summary += "\n\n## 今週あまり参照されなかった羅針盤項目\n" +
            `- **${neglected.title}**（関連度: ${Math.round(neglected.similarity * 100)}%）\n` +
            "この項目が今週の判断であまり反映されていなかった可能性があります。来週の改善提案に含めてください。";
          context = {
            ...(context ?? { hasCompass: true }),
            neglectedItem: { title: neglected.title, similarity: neglected.similarity },
          };
        }
      }

      return { summary, context };
    } catch {
      return { summary: "" };
    }
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
        let tasks: string[];
        try {
          const parsed = JSON.parse(d.tasksInput);
          tasks = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
        } catch {
          tasks = ["（タスクデータ不正）"];
        }
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
}
