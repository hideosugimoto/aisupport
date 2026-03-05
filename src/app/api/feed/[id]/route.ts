import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth();

    const plan = await getUserPlan(userId);
    if (!plan.feedEnabled) {
      return Response.json({ error: "フィード機能はProプランで利用できます" }, { status: 403 });
    }

    const { id } = await params;
    const articleId = parseInt(id, 10);

    if (Number.isNaN(articleId) || articleId < 1 || articleId > 2147483647) {
      return Response.json({ error: "無効なIDです" }, { status: 400 });
    }

    const article = await prisma.feedArticle.findFirst({
      where: { id: articleId, userId },
    });

    if (!article) {
      return Response.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "無効なリクエストです" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || !("isRead" in body)) {
      return Response.json({ error: "isReadは必須です" }, { status: 400 });
    }

    await prisma.feedArticle.update({
      where: { id: articleId },
      data: { isRead: Boolean((body as Record<string, unknown>).isRead) },
    });

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
