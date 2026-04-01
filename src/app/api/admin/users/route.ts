import { requireAdmin, handleAdminError } from "@/lib/auth/admin-guard";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ limit: 100, orderBy: "-created_at" });

    const userIds = clerkUsers.data.map((u) => u.id);

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, plan: true },
    });
    const subMap = new Map(subscriptions.map((s) => [s.userId, s.plan]));

    const statuses = await prisma.userStatus.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, suspended: true },
    });
    const statusMap = new Map(statuses.map((s) => [s.userId, s.suspended]));

    const users = clerkUsers.data.map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? "",
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      plan: subMap.get(u.id) ?? "free",
      suspended: statusMap.get(u.id) ?? false,
    }));

    return Response.json({ users, totalCount: clerkUsers.totalCount });
  } catch (error) {
    try {
      return handleAdminError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
