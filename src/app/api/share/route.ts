import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";

const MAX_CONTENT_LENGTH = 10000;
const DAILY_SHARE_LIMIT = 10;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const { content, tasks, provider, model } = body;

    if (!content || typeof content !== "string") {
      return Response.json({ error: "content は必須です" }, { status: 400 });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return Response.json(
        { error: `content は${MAX_CONTENT_LENGTH}文字以内にしてください` },
        { status: 400 }
      );
    }

    // ユーザーあたり1日10件までの制限
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const todayCount = await prisma.sharedResult.count({
      where: {
        userId,
        createdAt: { gte: todayStart, lt: tomorrowStart },
      },
    });

    if (todayCount >= DAILY_SHARE_LIMIT) {
      return Response.json(
        { error: "本日の共有上限に達しました（1日10件まで）" },
        { status: 429 }
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日後

    const shared = await prisma.sharedResult.create({
      data: {
        userId,
        content,
        tasks: JSON.stringify(Array.isArray(tasks) ? tasks : []),
        provider: provider ?? "unknown",
        model: model ?? "unknown",
        expiresAt,
      },
    });

    return Response.json({
      id: shared.id,
      url: `/share/${shared.id}`,
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json({ error: "内部エラー" }, { status: 500 });
    }
  }
}
