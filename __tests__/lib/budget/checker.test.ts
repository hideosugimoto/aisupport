import { describe, it, expect, vi } from "vitest";
import { BudgetChecker } from "@/lib/budget/checker";
import type { CostCalculator } from "@/lib/cost/calculator";
import type { MonthlyCostSummary } from "@/lib/cost/calculator";

function createMockCalculator(
  totalCostUsd: number
): CostCalculator {
  const mockSummary: MonthlyCostSummary = {
    year: 2026,
    month: 2,
    totalCostUsd,
    totalCostJpy: totalCostUsd * 150,
    breakdowns: [],
  };

  return {
    getMonthlySummary: vi.fn().mockResolvedValue(mockSummary),
    getDailyCosts: vi.fn(),
  } as unknown as CostCalculator;
}

describe("BudgetChecker", () => {
  const BUDGET_USD = 5.0;

  it("should return ok when usage is below 80%", async () => {
    // 3.5 USD = 70% of 5.0 USD
    const calculator = createMockCalculator(3.5);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.budgetUsd).toBe(5.0);
    expect(result.spentUsd).toBe(3.5);
    expect(result.remainingUsd).toBe(1.5);
    expect(result.percentUsed).toBe(70);
    expect(result.alertLevel).toBe("ok");
  });

  it("should return warning when usage is between 80% and 99%", async () => {
    // 4.5 USD = 90% of 5.0 USD
    const calculator = createMockCalculator(4.5);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.budgetUsd).toBe(5.0);
    expect(result.spentUsd).toBe(4.5);
    expect(result.remainingUsd).toBe(0.5);
    expect(result.percentUsed).toBe(90);
    expect(result.alertLevel).toBe("warning");
  });

  it("should return warning at exactly 80%", async () => {
    // 4.0 USD = 80% of 5.0 USD
    const calculator = createMockCalculator(4.0);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.percentUsed).toBe(80);
    expect(result.alertLevel).toBe("warning");
  });

  it("should return exceeded when usage is at 100%", async () => {
    // 5.0 USD = 100% of 5.0 USD
    const calculator = createMockCalculator(5.0);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.budgetUsd).toBe(5.0);
    expect(result.spentUsd).toBe(5.0);
    expect(result.remainingUsd).toBe(0);
    expect(result.percentUsed).toBe(100);
    expect(result.alertLevel).toBe("exceeded");
  });

  it("should return exceeded when usage is over 100%", async () => {
    // 6.0 USD = 120% of 5.0 USD
    const calculator = createMockCalculator(6.0);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.budgetUsd).toBe(5.0);
    expect(result.spentUsd).toBe(6.0);
    expect(result.remainingUsd).toBe(0); // Math.max(0, ...) prevents negative
    expect(result.percentUsed).toBe(120);
    expect(result.alertLevel).toBe("exceeded");
  });

  it("should never return negative remainingUsd", async () => {
    // 10.0 USD = 200% of 5.0 USD
    const calculator = createMockCalculator(10.0);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.remainingUsd).toBe(0);
    expect(result.remainingUsd).toBeGreaterThanOrEqual(0);
  });

  it("should handle zero spending", async () => {
    const calculator = createMockCalculator(0);
    const checker = new BudgetChecker(calculator, BUDGET_USD);

    const result = await checker.checkBudget(2026, 2);

    expect(result.spentUsd).toBe(0);
    expect(result.remainingUsd).toBe(5.0);
    expect(result.percentUsed).toBe(0);
    expect(result.alertLevel).toBe("ok");
  });
});
