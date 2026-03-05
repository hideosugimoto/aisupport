import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import type { TaskDecisionEntry } from "@/lib/db/types";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";

const repository = new PrismaTaskDecisionRepository(prisma);

// POST /api/history - Save decision result
export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await req.json();

    const MAX_STRING_LENGTH = 10000;

    // Validation
    const errors: string[] = [];
    if (!body.taskTitle || typeof body.taskTitle !== "string") {
      errors.push("taskTitle is required and must be a string");
    } else if (body.taskTitle.length > 200) {
      errors.push("taskTitle must be at most 200 characters");
    }
    if (!body.taskDescription || typeof body.taskDescription !== "string") {
      errors.push("taskDescription is required and must be a string");
    } else if (body.taskDescription.length > MAX_STRING_LENGTH) {
      errors.push("taskDescription must be at most 10000 characters");
    }
    if (!body.category || typeof body.category !== "string") {
      errors.push("category is required and must be a string");
    } else if (body.category.length > 100) {
      errors.push("category must be at most 100 characters");
    }
    if (typeof body.urgency !== "number" || body.urgency < 1 || body.urgency > 5) {
      errors.push("urgency is required and must be a number between 1 and 5");
    }
    if (!body.decision || typeof body.decision !== "string") {
      errors.push("decision is required and must be a string");
    } else if (body.decision.length > MAX_STRING_LENGTH) {
      errors.push("decision must be at most 10000 characters");
    }
    if (!body.provider || typeof body.provider !== "string") {
      errors.push("provider is required and must be a string");
    } else if (body.provider.length > 50) {
      errors.push("provider must be at most 50 characters");
    }
    if (body.model !== undefined && typeof body.model !== "string") {
      errors.push("model must be a string");
    } else if (typeof body.model === "string" && body.model.length > 100) {
      errors.push("model must be at most 100 characters");
    }
    if (typeof body.promptTokens !== "number" || !Number.isFinite(body.promptTokens) || body.promptTokens < 0 || body.promptTokens > 10_000_000) {
      errors.push("promptTokens is required and must be a finite non-negative number (max 10000000)");
    }
    if (typeof body.completionTokens !== "number" || !Number.isFinite(body.completionTokens) || body.completionTokens < 0 || body.completionTokens > 10_000_000) {
      errors.push("completionTokens is required and must be a finite non-negative number (max 10000000)");
    }
    if (typeof body.costUsd !== "number" || !Number.isFinite(body.costUsd) || body.costUsd < 0 || body.costUsd > 1000) {
      errors.push("costUsd is required and must be a finite non-negative number (max 1000)");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const tasks = Array.isArray(body.tasks) && body.tasks.length > 0
      ? body.tasks
          .filter((t: unknown) => typeof t === "string" && (t as string).trim())
          .slice(0, 50)
          .map((t: string) => ({ title: t.trim().slice(0, 500) }))
      : [
          {
            title: body.taskTitle,
            description: body.taskDescription,
            category: body.category,
            urgency: body.urgency,
          },
        ];

    const entry: TaskDecisionEntry = {
      userId,
      tasksInput: JSON.stringify(tasks),
      energyLevel: body.urgency,
      availableTime: typeof body.availableTime === "number" && Number.isFinite(body.availableTime) && body.availableTime > 0 && body.availableTime <= 1440
        ? body.availableTime
        : 60,
      provider: body.provider,
      model: body.model || "unknown",
      result: body.decision,
    };

    await repository.save(entry);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[history/POST]", error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { error: "履歴の保存に失敗しました" },
        { status: 500 }
      );
    }
  }
}

// GET /api/history - Search + Pagination
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(req.url);
    const qRaw = searchParams.get("q") || "";
    const q = qRaw.slice(0, 200);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "ページ番号が無効です" },
        { status: 400 }
      );
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "取得件数は1〜100の範囲で指定してください" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    let items;
    let total;

    if (q.trim().length > 0) {
      [items, total] = await Promise.all([
        repository.search(userId, q, limit, offset),
        repository.countBySearch(userId, q),
      ]);
    } else {
      [items, total] = await Promise.all([
        repository.findAll(userId, limit, offset),
        repository.count(userId),
      ]);
    }

    return NextResponse.json({
      items,
      total,
      page,
      limit,
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[history/GET]", error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        { error: "履歴の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}
