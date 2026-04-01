import { requireAdmin, handleAdminError } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const logs = await prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({ logs });
  } catch (error) {
    try {
      return handleAdminError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
