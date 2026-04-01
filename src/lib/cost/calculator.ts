import type { UsageLogRepository, ProviderCostSummary } from "../db/types";
import { calculateCostUsd, usdToJpy } from "./pricing";

export interface CostBreakdown {
  provider: string;
  model: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costUsd: number;
  costJpy: number;
}

export interface MonthlyCostSummary {
  year: number;
  month: number;
  totalCostUsd: number;
  totalCostJpy: number;
  breakdowns: CostBreakdown[];
}

export interface PromptVersionStats {
  version: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  costUsd: number;
  costJpy: number;
}

export class CostCalculator {
  constructor(private repository: UsageLogRepository) {}

  async getMonthlySummary(
    userId: string,
    year: number,
    month: number,
    keySource?: string
  ): Promise<MonthlyCostSummary> {
    const summaries = await this.repository.aggregateByProvider(userId, year, month, keySource);
    const breakdowns = summaries.map((s) => this.toBreakdown(s));

    const totalCostUsd = breakdowns.reduce((sum, b) => sum + b.costUsd, 0);

    return {
      year,
      month,
      totalCostUsd,
      totalCostJpy: usdToJpy(totalCostUsd),
      breakdowns,
    };
  }

  async getDailyCosts(
    userId: string,
    from: Date,
    to: Date,
    keySource?: string
  ): Promise<{ date: string; costUsd: number; costJpy: number }[]> {
    const logs = await this.repository.findByDateRange(userId, from, to, keySource);

    const dailyMap = new Map<string, number>();
    for (const log of logs) {
      const dateStr = (log.createdAt ?? new Date())
        .toISOString()
        .split("T")[0];
      const cost = calculateCostUsd(
        log.provider,
        log.model,
        log.inputTokens,
        log.outputTokens
      );
      dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + cost);
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, costUsd]) => ({
        date,
        costUsd,
        costJpy: usdToJpy(costUsd),
      }));
  }

  async getPromptVersionStats(
    userId: string,
    year: number,
    month: number,
    keySource?: string
  ): Promise<PromptVersionStats[]> {
    const logs = await this.repository.findByMonth(userId, year, month, keySource);

    const versionMap = new Map<
      string,
      {
        count: number;
        totalInput: number;
        totalOutput: number;
        provider: string;
        model: string;
      }
    >();

    for (const log of logs) {
      if (!log.metadata) continue;

      try {
        const metadata = JSON.parse(log.metadata);
        const version = metadata.prompt_version || "default";

        const existing = versionMap.get(version) || {
          count: 0,
          totalInput: 0,
          totalOutput: 0,
          provider: log.provider,
          model: log.model,
        };

        versionMap.set(version, {
          count: existing.count + 1,
          totalInput: existing.totalInput + log.inputTokens,
          totalOutput: existing.totalOutput + log.outputTokens,
          provider: log.provider,
          model: log.model,
        });
      } catch {
        continue;
      }
    }

    return Array.from(versionMap.entries())
      .map(([version, data]) => {
        const costUsd = calculateCostUsd(
          data.provider,
          data.model,
          data.totalInput,
          data.totalOutput
        );

        return {
          version,
          requestCount: data.count,
          totalInputTokens: data.totalInput,
          totalOutputTokens: data.totalOutput,
          avgInputTokens: Math.round(data.totalInput / data.count),
          avgOutputTokens: Math.round(data.totalOutput / data.count),
          costUsd,
          costJpy: usdToJpy(costUsd),
        };
      })
      .sort((a, b) => b.requestCount - a.requestCount);
  }

  private toBreakdown(summary: ProviderCostSummary): CostBreakdown {
    const costUsd = calculateCostUsd(
      summary.provider,
      summary.model,
      summary.totalInputTokens,
      summary.totalOutputTokens
    );
    return {
      provider: summary.provider,
      model: summary.model,
      requestCount: summary.requestCount,
      totalInputTokens: summary.totalInputTokens,
      totalOutputTokens: summary.totalOutputTokens,
      costUsd,
      costJpy: usdToJpy(costUsd),
    };
  }
}
