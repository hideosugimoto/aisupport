import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe/client";
import { clerkClient } from "@clerk/nextjs/server";

export async function DELETE() {
  try {
    const userId = await requireAuth();

    // Stripeサブスクリプションをキャンセル
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (err) {
        console.warn("[delete-account] Failed to cancel Stripe subscription:", err);
      }
    }

    // 全ユーザーデータを削除（依存関係順）
    await prisma.$transaction([
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

    // Clerkからユーザーを削除
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (err) {
      console.warn("[delete-account] Failed to delete Clerk user:", err);
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
