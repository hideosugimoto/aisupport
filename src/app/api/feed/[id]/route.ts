import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const articleId = Number(id);

    if (Number.isNaN(articleId)) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }

    const article = await prisma.feedArticle.findFirst({
      where: { id: articleId, userId },
    });

    if (!article) {
      return Response.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    await prisma.feedArticle.update({
      where: { id: articleId },
      data: { isRead: Boolean(body.isRead) },
    });

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }
}
