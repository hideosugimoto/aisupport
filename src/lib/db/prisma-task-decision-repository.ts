import { PrismaClient } from "../../generated/prisma/client";
import type {
  TaskDecisionRepository,
  TaskDecisionEntry,
  TaskDecisionRecord,
} from "./types";

export class PrismaTaskDecisionRepository implements TaskDecisionRepository {
  constructor(private prisma: PrismaClient) {}

  async save(entry: TaskDecisionEntry): Promise<void> {
    await this.prisma.taskDecision.create({
      data: {
        tasksInput: entry.tasksInput,
        energyLevel: entry.energyLevel,
        availableTime: entry.availableTime,
        provider: entry.provider,
        model: entry.model,
        result: entry.result,
      },
    });
  }

  async findAll(limit: number, offset: number): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async findByDateRange(from: Date, to: Date): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      where: {
        createdAt: { gte: from, lt: to },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async search(
    keyword: string,
    limit: number,
    offset: number
  ): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      where: {
        result: { contains: keyword },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(): Promise<number> {
    return await this.prisma.taskDecision.count();
  }

  async countBySearch(keyword: string): Promise<number> {
    return await this.prisma.taskDecision.count({
      where: {
        result: { contains: keyword },
      },
    });
  }
}
