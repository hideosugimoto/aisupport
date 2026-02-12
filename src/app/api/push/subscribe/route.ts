import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[push/subscribe]", error);
    return Response.json(
      { error: "サブスクリプション登録に失敗しました" },
      { status: 500 }
    );
  }
}
