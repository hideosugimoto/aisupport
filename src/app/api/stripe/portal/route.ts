import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  try {
    const userId = await requireAuth();

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      return Response.json(
        { error: "Stripeカスタマーが見つかりません" },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/settings`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[stripe/portal]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "ポータルセッションの作成に失敗しました" },
        { status: 500 }
      );
    }
  }
}
