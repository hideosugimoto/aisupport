import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const userId = await requireAuth();
    const plan = await getUserPlan(userId);

    if (!plan.feedEnabled) {
      return Response.json(
        { error: "フィード機能はProプランで利用できます" },
        { status: 403 }
      );
    }

    const keywords = await prisma.feedKeyword.findMany({
      where: { userId },
      select: { id: true, keyword: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ keywords });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
