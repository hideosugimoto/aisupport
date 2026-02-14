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
        userId: entry.userId ?? "legacy",
        tasksInput: entry.tasksInput,
        energyLevel: entry.energyLevel,
        availableTime: entry.availableTime,
        provider: entry.provider,
        model: entry.model,
        result: entry.result,
      },
    });
  }

  async findAll(userId: string, limit: number, offset: number): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async findByDateRange(userId: string, from: Date, to: Date): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      where: {
        userId,
        createdAt: { gte: from, lt: to },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async search(
    userId: string,
    keyword: string,
    limit: number,
    offset: number
  ): Promise<TaskDecisionRecord[]> {
    return await this.prisma.taskDecision.findMany({
      where: {
        userId,
        result: { contains: keyword },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async count(userId: string): Promise<number> {
    return await this.prisma.taskDecision.count({
      where: { userId },
    });
  }

  async countBySearch(userId: string, keyword: string): Promise<number> {
    return await this.prisma.taskDecision.count({
      where: {
        userId,
        result: { contains: keyword },
      },
    });
  }
}
