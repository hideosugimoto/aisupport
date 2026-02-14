import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { clerkClient } from "@clerk/nextjs/server";

export async function DELETE() {
  try {
    const userId = await requireAuth();

    // 1. Stripe サブスクリプションをキャンセル（失敗しても続行）
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (err) {
        console.warn("[delete-account] Stripe cancel failed (non-critical):", err);
      }
    }

    // 2. 全ユーザーデータを削除（個人情報保護を最優先）
    await prisma.$transaction([
      prisma.compassChunk.deleteMany({
        where: { compassItem: { userId } },
      }),
      prisma.compassItem.deleteMany({ where: { userId } }),
      prisma.documentChunk.deleteMany({
        where: { document: { userId } },
      }),
      prisma.document.deleteMany({ where: { userId } }),
      prisma.llmUsageLog.deleteMany({ where: { userId } }),
      prisma.taskDecision.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.notificationSetting.deleteMany({ where: { userId } }),
      prisma.userApiKey.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
    ]);

    // 3. Clerk からユーザーを削除（DB削除後に実行）
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (err) {
      console.error("[delete-account] Clerk delete failed (user data already removed):", err);
      return Response.json({
        success: true,
        warning: "データは削除されましたが、認証情報の削除に失敗しました。サポートにお問い合わせください",
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[delete-account]", error);
      return Response.json(
        { error: "アカウント削除に失敗しました" },
        { status: 500 }
      );
    }
  }
}
