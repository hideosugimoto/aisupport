import { NextRequest } from "next/server";
import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(request: NextRequest) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return Response.json(
        { error: "プッシュ通知が設定されていません" },
        { status: 503 }
      );
    }

    const userId = await requireAuth();
    const body = await request.json();
    const { title, message, url } = body;

    if (!title || typeof title !== "string" || title.length > 200) {
      return Response.json(
        { error: "titleは200文字以内の文字列で指定してください" },
        { status: 400 }
      );
    }
    if (!message || typeof message !== "string" || message.length > 1000) {
      return Response.json(
        { error: "messageは1000文字以内の文字列で指定してください" },
        { status: 400 }
      );
    }

    if (url !== undefined) {
      if (typeof url !== "string" || url.length > 2000 || (!url.startsWith("https://") && !url.startsWith("/"))) {
        return Response.json(
          { error: "URLはhttps://または/で始まる文字列を指定してください" },
          { status: 400 }
        );
      }
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return Response.json({ sent: 0, message: "No subscriptions" });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url ?? "/",
    });

    let sent = 0;
    const failed: number[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (error) {
        if (error instanceof webpush.WebPushError && error.statusCode === 410) {
          failed.push(sub.id);
        }
      }
    }

    if (failed.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: failed } },
      });
    }

    return Response.json({ sent, expired: failed.length });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[push/send]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "プッシュ通知の送信に失敗しました" },
        { status: 500 }
      );
    }
  }
}
