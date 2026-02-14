import { describe, it, expect, vi } from "vitest";
import { CostCalculator } from "@/lib/cost/calculator";
import { calculateCostUsd, usdToJpy } from "@/lib/cost/pricing";
import type {
  UsageLogRepository,
  UsageLogEntry,
  ProviderCostSummary,
} from "@/lib/db/types";

function createMockRepository(
  overrides?: Partial<UsageLogRepository>
): UsageLogRepository {
  return {
    save: vi.fn(),
    findByMonth: vi.fn().mockResolvedValue([]),
    findByDateRange: vi.fn().mockResolvedValue([]),
    aggregateByProvider: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("calculateCostUsd", () => {
  it("should calculate OpenAI gpt-4o-mini cost correctly", () => {
    // pricing.json: input_per_1m = 0.15, output_per_1m = 0.60
    const cost = calculateCostUsd("openai", "gpt-4o-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.75); // 0.15 + 0.60
  });

  it("should calculate Gemini cost correctly", () => {
    // pricing.json: input_per_1m = 0.10, output_per_1m = 0.40
    const cost = calculateCostUsd("gemini", "gemini-2.0-flash", 500_000, 200_000);
    expect(cost).toBeCloseTo(0.13); // 0.05 + 0.08
  });

  it("should return 0 for unknown provider/model", () => {
    const cost = calculateCostUsd("unknown", "unknown-model", 1000, 1000);
    expect(cost).toBe(0);
  });
});

describe("usdToJpy", () => {
  it("should convert USD to JPY using exchange rate", () => {
    // pricing.json: exchange_rate_jpy = 150
    const jpy = usdToJpy(1.0);
    expect(jpy).toBe(150);
  });
});

describe("CostCalculator", () => {
  it("should compute monthly summary from aggregated data", async () => {
    const summaries: ProviderCostSummary[] = [
      {
        provider: "openai",
        model: "gpt-4o-mini",
        totalInputTokens: 100_000,
        totalOutputTokens: 50_000,
        totalTokens: 150_000,
        requestCount: 10,
      },
      {
        provider: "gemini",
        model: "gemini-2.0-flash",
        totalInputTokens: 200_000,
        totalOutputTokens: 100_000,
        totalTokens: 300_000,
        requestCount: 20,
      },
    ];

    const repo = createMockRepository({
      aggregateByProvider: vi.fn().mockResolvedValue(summaries),
    });

    const calculator = new CostCalculator(repo);
    const result = await calculator.getMonthlySummary("test-user", 2026, 2);

    expect(result.year).toBe(2026);
    expect(result.month).toBe(2);
    expect(result.breakdowns).toHaveLength(2);
    expect(result.totalCostUsd).toBeGreaterThan(0);
    expect(result.totalCostJpy).toBe(result.totalCostUsd * 150);
  });

  it("should compute daily costs from log entries", async () => {
    const logs: UsageLogEntry[] = [
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        feature: "task_decision",
        createdAt: new Date("2026-02-10T10:00:00Z"),
      },
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        feature: "task_decision",
        createdAt: new Date("2026-02-10T15:00:00Z"),
      },
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
        feature: "task_decision",
        createdAt: new Date("2026-02-11T08:00:00Z"),
      },
    ];

    const repo = createMockRepository({
      findByDateRange: vi.fn().mockResolvedValue(logs),
    });

    const calculator = new CostCalculator(repo);
    const from = new Date("2026-02-10");
    const to = new Date("2026-02-12");
    const result = await calculator.getDailyCosts("test-user", from, to);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-02-10");
    expect(result[1].date).toBe("2026-02-11");
    expect(result[0].costUsd).toBeGreaterThan(result[1].costUsd);
  });
});
