import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Get or create default settings (single-user app)
    let settings = await prisma.notificationSetting.findFirst();
    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: {
          reminderEnabled: false,
          reminderTime: "09:00",
          budgetAlert: true,
        },
      });
    }
    return Response.json(settings);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { reminderEnabled, reminderTime, budgetAlert } = body;

    let settings = await prisma.notificationSetting.findFirst();

    if (settings) {
      settings = await prisma.notificationSetting.update({
        where: { id: settings.id },
        data: {
          ...(reminderEnabled !== undefined && { reminderEnabled }),
          ...(reminderTime !== undefined && { reminderTime }),
          ...(budgetAlert !== undefined && { budgetAlert }),
        },
      });
    } else {
      settings = await prisma.notificationSetting.create({
        data: {
          reminderEnabled: reminderEnabled ?? false,
          reminderTime: reminderTime ?? "09:00",
          budgetAlert: budgetAlert ?? true,
        },
      });
    }

    return Response.json(settings);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
