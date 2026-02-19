import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserPlan, checkRequestLimit, type PlanInfo } from "@/lib/billing/plan-gate";

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    llmUsageLog: { count: vi.fn() },
  },
}));

// Import mocked prisma to set return values
import { prisma } from "@/lib/db/prisma";

describe("plan-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserPlan", () => {
    it("should return free plan for user without subscription", async () => {
      // Mock: no subscription found
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await getUserPlan("user-without-subscription");

      expect(result).toEqual({
        plan: "free",
        monthlyRequestLimit: 30,
        ragEnabled: false,
        weeklyReviewEnabled: false,
        compassEnabled: true,
        compassMaxItems: 10,
        compassImageEnabled: false,
        compassUrlEnabled: false,
        feedEnabled: false,
      });

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-without-subscription" },
      });
    });

    it("should return pro plan for user with active pro subscription", async () => {
      // Mock: pro subscription found
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: "sub-123",
        userId: "pro-user",
        plan: "pro",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getUserPlan("pro-user");

      expect(result).toEqual({
        plan: "pro",
        monthlyRequestLimit: -1,
        ragEnabled: true,
        weeklyReviewEnabled: true,
        compassEnabled: true,
        compassMaxItems: -1,
        compassImageEnabled: true,
        compassUrlEnabled: true,
        feedEnabled: true,
      });

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: "pro-user" },
      });
    });

    it("should return free plan for user with free subscription", async () => {
      // Mock: free subscription found
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: "sub-456",
        userId: "free-user",
        plan: "free",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getUserPlan("free-user");

      expect(result).toEqual({
        plan: "free",
        monthlyRequestLimit: 30,
        ragEnabled: false,
        weeklyReviewEnabled: false,
        compassEnabled: true,
        compassMaxItems: 10,
        compassImageEnabled: false,
        compassUrlEnabled: false,
        feedEnabled: false,
      });
    });

    it("should fallback to free plan for invalid plan ID", async () => {
      // Mock: subscription with invalid plan
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: "sub-789",
        userId: "invalid-plan-user",
        plan: "invalid-plan" as any,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await getUserPlan("invalid-plan-user");

      // Should fallback to free plan config when plan is not found
      expect(result).toEqual({
        plan: "invalid-plan", // plan ID is kept as-is
        monthlyRequestLimit: 30, // but config is from free plan
        ragEnabled: false,
        weeklyReviewEnabled: false,
        compassEnabled: true,
        compassMaxItems: 10,
        compassImageEnabled: false,
        compassUrlEnabled: false,
        feedEnabled: false,
      });
    });
  });

  describe("checkRequestLimit", () => {
    // Helper to create plan info
    const freePlan: PlanInfo = {
      plan: "free",
      monthlyRequestLimit: 30,
      ragEnabled: false,
      weeklyReviewEnabled: false,
      compassEnabled: true,
      compassMaxItems: 10,
      compassImageEnabled: false,
      compassUrlEnabled: false,
      feedEnabled: false,
    };

    const proPlan: PlanInfo = {
      plan: "pro",
      monthlyRequestLimit: -1,
      ragEnabled: true,
      weeklyReviewEnabled: true,
      compassEnabled: true,
      compassMaxItems: -1,
      compassImageEnabled: true,
      compassUrlEnabled: true,
      feedEnabled: true,
    };

    it("should allow when under limit", async () => {
      // Mock: user has used 10 out of 30 requests
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(10);

      const result = await checkRequestLimit("user-123", freePlan);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);

      // Verify count was called with correct date range
      const call = vi.mocked(prisma.llmUsageLog.count).mock.calls[0][0];
      expect(call.where.userId).toBe("user-123");
      expect(call.where.createdAt).toHaveProperty("gte");
      expect(call.where.createdAt).toHaveProperty("lt");
    });

    it("should deny when at limit", async () => {
      // Mock: user has used exactly 30 out of 30 requests
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(30);

      const result = await checkRequestLimit("user-at-limit", freePlan);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should deny when over limit", async () => {
      // Mock: user has used 35 out of 30 requests
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(35);

      const result = await checkRequestLimit("user-over-limit", freePlan);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0); // Math.max(0, ...) prevents negative
    });

    it("should return unlimited for pro plan", async () => {
      // Mock: count should not be called for unlimited plans
      const result = await checkRequestLimit("pro-user", proPlan);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);

      // Verify count was NOT called (optimization for unlimited plans)
      expect(prisma.llmUsageLog.count).not.toHaveBeenCalled();
    });

    it("should accept pre-fetched plan to avoid double query", async () => {
      // Mock: usage count
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(5);

      // Pass pre-fetched plan - should NOT call getUserPlan
      const result = await checkRequestLimit("user-prefetched", freePlan);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(25);

      // Verify subscription was NOT queried (plan was pre-fetched)
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled();

      // But usage count was queried
      expect(prisma.llmUsageLog.count).toHaveBeenCalledOnce();
    });

    it("should fetch plan if not provided", async () => {
      // Mock: subscription query
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      // Mock: usage count
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(15);

      // Do NOT pass plan - should call getUserPlan
      const result = await checkRequestLimit("user-auto-fetch");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15); // 30 - 15

      // Verify subscription was queried (plan was NOT pre-fetched)
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-auto-fetch" },
      });

      // And usage count was queried
      expect(prisma.llmUsageLog.count).toHaveBeenCalledOnce();
    });

    it("should calculate remaining count correctly", async () => {
      const testCases = [
        { used: 0, expected: 30 },
        { used: 1, expected: 29 },
        { used: 15, expected: 15 },
        { used: 29, expected: 1 },
        { used: 30, expected: 0 },
        { used: 35, expected: 0 }, // over limit, should be clamped to 0
      ];

      for (const { used, expected } of testCases) {
        vi.clearAllMocks();
        vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(used);

        const result = await checkRequestLimit(`user-${used}`, freePlan);

        expect(result.remaining).toBe(expected);
        expect(result.remaining).toBeGreaterThanOrEqual(0); // Never negative
      }
    });

    it("should use correct date range for current month", async () => {
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(10);

      await checkRequestLimit("user-date-test", freePlan);

      const call = vi.mocked(prisma.llmUsageLog.count).mock.calls[0][0];
      const now = new Date();
      const expectedMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const expectedMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      expect(call.where.createdAt.gte).toEqual(expectedMonthStart);
      expect(call.where.createdAt.lt).toEqual(expectedMonthEnd);
    });

    it("should handle zero usage", async () => {
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(0);

      const result = await checkRequestLimit("new-user", freePlan);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30);
    });

    it("should correctly check boundary at limit - 1", async () => {
      // 29 requests used, 1 remaining - should still allow
      vi.mocked(prisma.llmUsageLog.count).mockResolvedValue(29);

      const result = await checkRequestLimit("user-almost-limit", freePlan);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });
});
