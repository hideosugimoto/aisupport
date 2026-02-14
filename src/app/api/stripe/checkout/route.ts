import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  try {
    const userId = await requireAuth();

    // 既存のStripeカスタマーを取得、なければ作成
    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId },
      });
      customerId = customer.id;

      // Subscriptionレコードを作成/更新
      await prisma.subscription.upsert({
        where: { userId },
        update: { stripeCustomerId: customerId },
        create: {
          userId,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
        },
      });
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return Response.json(
        { error: "Stripe価格IDが設定されていません" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings?checkout=cancel`,
      metadata: { userId },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[stripe/checkout]", error);
      return Response.json(
        { error: "チェックアウトセッションの作成に失敗しました" },
        { status: 500 }
      );
    }
  }
}
