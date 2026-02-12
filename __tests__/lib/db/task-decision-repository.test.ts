import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaTaskDecisionRepository } from "../../../src/lib/db/prisma-task-decision-repository";
import type { TaskDecisionEntry } from "../../../src/lib/db/types";

describe("PrismaTaskDecisionRepository", () => {
  let mockPrisma: {
    taskDecision: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  let repository: PrismaTaskDecisionRepository;

  beforeEach(() => {
    mockPrisma = {
      taskDecision: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    repository = new PrismaTaskDecisionRepository(
      mockPrisma as unknown as PrismaClient
    );
  });

  describe("save", () => {
    it("should save a task decision entry", async () => {
      const entry: TaskDecisionEntry = {
        tasksInput: JSON.stringify([
          { name: "Task 1", estimated: 30 },
          { name: "Task 2", estimated: 45 },
        ]),
        energyLevel: 7,
        availableTime: 60,
        provider: "openai",
        model: "gpt-4o-mini",
        result: JSON.stringify({
          selected: ["Task 1"],
          reasoning: "Fits time budget",
        }),
      };

      mockPrisma.taskDecision.create.mockResolvedValue({
        id: 1,
        tasksInput: entry.tasksInput,
        energyLevel: entry.energyLevel,
        availableTime: entry.availableTime,
        provider: entry.provider,
        model: entry.model,
        result: entry.result,
        createdAt: new Date(),
      });

      await repository.save(entry);

      expect(mockPrisma.taskDecision.create).toHaveBeenCalledWith({
        data: {
          tasksInput: entry.tasksInput,
          energyLevel: entry.energyLevel,
          availableTime: entry.availableTime,
          provider: entry.provider,
          model: entry.model,
          result: entry.result,
        },
      });
    });
  });

  describe("findAll", () => {
    it("should return all records with pagination", async () => {
      const mockRecords = [
        {
          id: 1,
          tasksInput: "[]",
          energyLevel: 5,
          availableTime: 30,
          provider: "openai",
          model: "gpt-4o-mini",
          result: "{}",
          createdAt: new Date("2026-02-01"),
        },
        {
          id: 2,
          tasksInput: "[]",
          energyLevel: 7,
          availableTime: 60,
          provider: "google",
          model: "gemini-2.0-flash",
          result: "{}",
          createdAt: new Date("2026-02-02"),
        },
      ];

      mockPrisma.taskDecision.findMany.mockResolvedValue(mockRecords);

      const result = await repository.findAll(10, 0);

      expect(mockPrisma.taskDecision.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(mockRecords);
    });

    it("should apply offset and limit correctly", async () => {
      mockPrisma.taskDecision.findMany.mockResolvedValue([]);

      await repository.findAll(5, 10);

      expect(mockPrisma.taskDecision.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        take: 5,
        skip: 10,
      });
    });
  });

  describe("findByDateRange", () => {
    it("should return records within date range", async () => {
      const from = new Date("2026-02-01");
      const to = new Date("2026-02-10");
      const mockRecords = [
        {
          id: 1,
          tasksInput: "[]",
          energyLevel: 5,
          availableTime: 30,
          provider: "openai",
          model: "gpt-4o-mini",
          result: "{}",
          createdAt: new Date("2026-02-05"),
        },
      ];

      mockPrisma.taskDecision.findMany.mockResolvedValue(mockRecords);

      const result = await repository.findByDateRange(from, to);

      expect(mockPrisma.taskDecision.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: from, lt: to },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockRecords);
    });
  });

  describe("search", () => {
    it("should search by keyword in result field", async () => {
      const keyword = "urgent";
      const mockRecords = [
        {
          id: 1,
          tasksInput: "[]",
          energyLevel: 5,
          availableTime: 30,
          provider: "openai",
          model: "gpt-4o-mini",
          result: JSON.stringify({
            selected: ["Task 1"],
            reasoning: "urgent task",
          }),
          createdAt: new Date("2026-02-05"),
        },
      ];

      mockPrisma.taskDecision.findMany.mockResolvedValue(mockRecords);

      const result = await repository.search(keyword, 10, 0);

      expect(mockPrisma.taskDecision.findMany).toHaveBeenCalledWith({
        where: {
          result: { contains: keyword },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(mockRecords);
    });

    it("should apply pagination in search", async () => {
      mockPrisma.taskDecision.findMany.mockResolvedValue([]);

      await repository.search("test", 20, 10);

      expect(mockPrisma.taskDecision.findMany).toHaveBeenCalledWith({
        where: {
          result: { contains: "test" },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 10,
      });
    });
  });

  describe("count", () => {
    it("should return total count of records", async () => {
      mockPrisma.taskDecision.count.mockResolvedValue(42);

      const result = await repository.count();

      expect(mockPrisma.taskDecision.count).toHaveBeenCalledWith();
      expect(result).toBe(42);
    });

    it("should return 0 when no records exist", async () => {
      mockPrisma.taskDecision.count.mockResolvedValue(0);

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });

  describe("countBySearch", () => {
    it("should return count of matching records", async () => {
      const keyword = "important";
      mockPrisma.taskDecision.count.mockResolvedValue(15);

      const result = await repository.countBySearch(keyword);

      expect(mockPrisma.taskDecision.count).toHaveBeenCalledWith({
        where: {
          result: { contains: keyword },
        },
      });
      expect(result).toBe(15);
    });

    it("should return 0 when no matches found", async () => {
      mockPrisma.taskDecision.count.mockResolvedValue(0);

      const result = await repository.countBySearch("nonexistent");

      expect(result).toBe(0);
    });
  });
});
