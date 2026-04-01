import { NextRequest } from "next/server";
import { requireAdmin, handleAdminError, logAdminAction } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/db/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const adminId = await requireAdmin();
    const { id: targetUserId } = await context.params;
    const body = await request.json();
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    await prisma.userStatus.upsert({
      where: { userId: targetUserId },
      update: { suspended: true, reason },
      create: { userId: targetUserId, suspended: true, reason },
    });

    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined;
    await logAdminAction(adminId, "user_suspend", targetUserId, reason, ip);

    return Response.json({ success: true, message: "ユーザーを停止しました" });
  } catch (error) {
    try {
      return handleAdminError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
