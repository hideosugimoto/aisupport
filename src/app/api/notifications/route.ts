import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

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
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to get settings" },
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
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to update settings" },
        { status: 500 }
      );
    }
  }
}
