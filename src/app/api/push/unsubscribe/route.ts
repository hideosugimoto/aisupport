import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return Response.json({ error: "Endpoint required" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[push/unsubscribe]", error);
    return Response.json(
      { error: "サブスクリプション解除に失敗しました" },
      { status: 500 }
    );
  }
}
