"use client";

import { useState, useCallback } from "react";

export function useBudgetCheck() {
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);

  const checkBudget = useCallback(async (): Promise<boolean> => {
    try {
      const costResponse = await fetch("/api/cost");
      if (costResponse.ok) {
        const costData = await costResponse.json();
        if (costData.budget) {
          if (costData.budget.alertLevel === "exceeded") {
            const confirmed = window.confirm(
              "月間予算を超過しています。それでも実行しますか？"
            );
            if (!confirmed) return false;
          } else if (costData.budget.alertLevel === "warning") {
            setBudgetWarning("予算の80%を超えています。注意してください。");
          } else {
            setBudgetWarning(null);
          }
        }
      }
    } catch {
      // Budget check failure is non-critical
    }
    return true;
  }, []);

  const clearWarning = useCallback(() => setBudgetWarning(null), []);

  return { budgetWarning, checkBudget, clearWarning };
}
