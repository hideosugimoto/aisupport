import { PrismaClient } from "../../generated/prisma/client";
import type {
  UsageLogRepository,
  UsageLogEntry,
  ProviderCostSummary,
} from "./types";

export class PrismaUsageLogRepository implements UsageLogRepository {
  constructor(private prisma: PrismaClient) {}

  async save(log: UsageLogEntry): Promise<void> {
    await this.prisma.llmUsageLog.create({
      data: {
        userId: log.userId ?? "legacy",
        provider: log.provider,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        feature: log.feature,
        requestId: log.requestId ?? null,
        metadata: log.metadata ?? null,
      },
    });
  }

  async findByMonth(userId: string, year: number, month: number): Promise<UsageLogEntry[]> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    return this.findByDateRange(userId, from, to);
  }

  async findByDateRange(userId: string, from: Date, to: Date): Promise<UsageLogEntry[]> {
    const logs = await this.prisma.llmUsageLog.findMany({
      where: {
        userId,
        createdAt: { gte: from, lt: to },
      },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      provider: log.provider,
      model: log.model,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      totalTokens: log.totalTokens,
      feature: log.feature,
      requestId: log.requestId ?? undefined,
      metadata: log.metadata ?? undefined,
      createdAt: log.createdAt,
    }));
  }

  async aggregateByProvider(
    userId: string,
    year: number,
    month: number
  ): Promise<ProviderCostSummary[]> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const results = await this.prisma.llmUsageLog.groupBy({
      by: ["provider", "model"],
      where: {
        userId,
        createdAt: { gte: from, lt: to },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    return results.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalInputTokens: r._sum.inputTokens ?? 0,
      totalOutputTokens: r._sum.outputTokens ?? 0,
      totalTokens: r._sum.totalTokens ?? 0,
      requestCount: r._count,
    }));
  }
}
