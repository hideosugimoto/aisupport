import { NextRequest } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/auth/admin-guard";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const client = await clerkClient();
    const user = await client.users.getUser(id);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: id },
    });

    const status = await prisma.userStatus.findUnique({
      where: { userId: id },
    });

    const usageCount = await prisma.llmUsageLog.count({
      where: { userId: id },
    });

    const lastDecision = await prisma.taskDecision.findFirst({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return Response.json({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? "",
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      plan: subscription?.plan ?? "free",
      stripeCustomerId: subscription?.stripeCustomerId ?? null,
      stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
      subscriptionStatus: subscription?.status ?? null,
      suspended: status?.suspended ?? false,
      suspendReason: status?.reason ?? null,
      totalUsage: usageCount,
      lastActivity: lastDecision?.createdAt ?? null,
    });
  } catch (error) {
    try {
      return handleAdminError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
