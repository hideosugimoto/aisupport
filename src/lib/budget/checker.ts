import type { CostCalculator } from "@/lib/cost/calculator";

export type AlertLevel = "ok" | "warning" | "exceeded";

export interface BudgetStatus {
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
  alertLevel: AlertLevel;
}

export class BudgetChecker {
  constructor(
    private calculator: CostCalculator,
    private budgetUsd: number
  ) {}

  async checkBudget(userId: string, year: number, month: number): Promise<BudgetStatus> {
    const summary = await this.calculator.getMonthlySummary(userId, year, month);
    const spentUsd = summary.totalCostUsd;
    const percentUsed = (spentUsd / this.budgetUsd) * 100;

    let alertLevel: AlertLevel = "ok";
    if (percentUsed >= 100) alertLevel = "exceeded";
    else if (percentUsed >= 80) alertLevel = "warning";

    return {
      budgetUsd: this.budgetUsd,
      spentUsd,
      remainingUsd: Math.max(0, this.budgetUsd - spentUsd),
      percentUsed,
      alertLevel,
    };
  }
}
