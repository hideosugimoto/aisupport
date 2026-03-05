import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const compassItemId = parseInt(id, 10);

    if (isNaN(compassItemId)) {
      return Response.json({ error: "無効なIDです" }, { status: 400 });
    }

    // 整数境界チェック（セキュリティ対策）
    if (compassItemId < 1 || compassItemId > 2147483647) { // PostgreSQL INT max
      return Response.json({ error: "無効なIDです" }, { status: 400 });
    }

    // Verify ownership and delete
    const item = await prisma.compassItem.findFirst({
      where: { id: compassItemId, userId },
    });

    if (!item) {
      return Response.json(
        { error: "アイテムが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.compassItem.delete({
      where: { id: compassItemId },
    });

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[compass] DELETE error:", error instanceof Error ? error.message : String(error));
      return Response.json({ error: "削除に失敗しました" }, { status: 500 });
    }
  }
}
