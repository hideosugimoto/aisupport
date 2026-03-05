import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const userId = await requireAuth();
    let settings = await prisma.notificationSetting.findUnique({
      where: { userId },
    });
    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: {
          userId,
          reminderEnabled: false,
          reminderTime: "09:00",
          budgetAlert: true,
          digestEnabled: true,
        },
      });
    }
    return Response.json(settings);
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[notifications/GET]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "設定の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { reminderEnabled, reminderTime, budgetAlert, digestEnabled } = body;

    // Input validation
    if (reminderEnabled !== undefined && typeof reminderEnabled !== "boolean") {
      return Response.json({ error: "reminderEnabled must be a boolean" }, { status: 400 });
    }
    if (reminderTime !== undefined && (typeof reminderTime !== "string" || !REMINDER_TIME_RE.test(reminderTime))) {
      return Response.json({ error: "reminderTime must be HH:MM format" }, { status: 400 });
    }
    if (budgetAlert !== undefined && typeof budgetAlert !== "boolean") {
      return Response.json({ error: "budgetAlert must be a boolean" }, { status: 400 });
    }
    if (digestEnabled !== undefined && typeof digestEnabled !== "boolean") {
      return Response.json({ error: "digestEnabled must be a boolean" }, { status: 400 });
    }

    const settings = await prisma.notificationSetting.upsert({
      where: { userId },
      create: {
        userId,
        reminderEnabled: reminderEnabled ?? false,
        reminderTime: reminderTime ?? "09:00",
        budgetAlert: budgetAlert ?? true,
        digestEnabled: digestEnabled ?? true,
      },
      update: {
        ...(reminderEnabled !== undefined && { reminderEnabled }),
        ...(reminderTime !== undefined && { reminderTime }),
        ...(budgetAlert !== undefined && { budgetAlert }),
        ...(digestEnabled !== undefined && { digestEnabled }),
      },
    });

    return Response.json(settings);
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[notifications/PUT]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "設定の更新に失敗しました" },
        { status: 500 }
      );
    }
  }
}
