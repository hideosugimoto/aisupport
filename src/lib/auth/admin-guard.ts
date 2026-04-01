import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AdminError("認証が必要です");
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as Record<string, unknown>)?.role;

  if (role !== "admin") {
    throw new AdminError("管理者権限が必要です");
  }

  return userId;
}

export function handleAdminError(error: unknown): Response {
  if (error instanceof AdminError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  throw error;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetId?: string,
  detail?: string,
  ipAddress?: string
): Promise<void> {
  await prisma.adminLog.create({
    data: { adminId, action, targetId, detail, ipAddress },
  });
}
