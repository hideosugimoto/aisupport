import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return Response.json(
        { error: "無効なサブスクリプションデータです" },
        { status: 400 }
      );
    }
    if (endpoint.length > 2000) {
      return Response.json(
        { error: "エンドポイントURLが長すぎます" },
        { status: 400 }
      );
    }
    if (!keys?.p256dh || typeof keys.p256dh !== "string" || keys.p256dh.length > 500) {
      return Response.json(
        { error: "無効なp256dhキーです" },
        { status: 400 }
      );
    }
    if (!keys?.auth || typeof keys.auth !== "string" || keys.auth.length > 500) {
      return Response.json(
        { error: "無効な認証キーです" },
        { status: 400 }
      );
    }

    try {
      const parsedUrl = new URL(endpoint);
      if (parsedUrl.protocol !== "https:") {
        return Response.json(
          { error: "エンドポイントはHTTPSが必要です" },
          { status: 400 }
        );
      }
    } catch {
      return Response.json(
        { error: "無効なエンドポイントURLです" },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[push/subscribe]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "サブスクリプション登録に失敗しました" },
        { status: 500 }
      );
    }
  }
}
