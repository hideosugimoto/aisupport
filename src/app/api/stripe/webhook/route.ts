import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/db/prisma";
import type Stripe from "stripe";

// Webhook冪等性チェック用（メモリ内、TTL付き）
// NOTE: サーバーレス環境ではインスタンス間でMapが共有されないため best-effort。
// DB upsert を使用しているため、重複処理されても結果は冪等。
// 将来的に Redis 等の外部ストアへの移行を検討。
const PROCESSED_EVENT_TTL_MS = 5 * 60 * 1000; // 5分
const processedEvents = new Map<string, number>();

function cleanupProcessedEvents() {
  const now = Date.now();
  for (const [id, timestamp] of processedEvents) {
    if (now - timestamp > PROCESSED_EVENT_TTL_MS) {
      processedEvents.delete(id);
    }
  }
}

function getPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  if (item?.current_period_end) {
    return new Date(item.current_period_end * 1000);
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "署名がありません" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook設定エラー" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "署名検証に失敗しました" }, { status: 400 });
  }

  // Replay Attack対策: 処理済みイベントIDをチェック
  cleanupProcessedEvents();
  if (processedEvents.has(event.id)) {
    return Response.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!session.subscription) {
          console.warn("[stripe/webhook] No subscription in checkout.session.completed");
          break;
        }
        if (userId) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = getPeriodEnd(sub);
          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: subscriptionId,
              plan: "pro",
              status: sub.status,
              currentPeriodEnd: periodEnd,
            },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscriptionId,
              plan: "pro",
              status: sub.status,
              currentPeriodEnd: periodEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const existing = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (existing) {
          const plan = sub.status === "active" ? "pro" : "free";
          const periodEnd = getPeriodEnd(sub);
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              status: sub.status,
              plan,
              currentPeriodEnd: periodEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const existing = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              plan: "free",
              status: "canceled",
              stripeSubscriptionId: null,
              currentPeriodEnd: null,
            },
          });
        }
        break;
      }
    }

    // 成功時のみ処理済みとして記録（失敗時はStripeにリトライさせる）
    processedEvents.set(event.id, Date.now());

    return Response.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] processing error:", error instanceof Error ? error.message : String(error));
    return Response.json(
      { error: "Webhookの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
