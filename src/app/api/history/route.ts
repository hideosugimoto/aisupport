import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import type { TaskDecisionEntry } from "@/lib/db/types";

const repository = new PrismaTaskDecisionRepository(prisma);

// POST /api/history - Save decision result
export async function POST(req: NextRequest) {
  try {
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
    }
    if (typeof body.promptTokens !== "number" || body.promptTokens < 0) {
      errors.push("promptTokens is required and must be a non-negative number");
    }
    if (typeof body.completionTokens !== "number" || body.completionTokens < 0) {
      errors.push("completionTokens is required and must be a non-negative number");
    }
    if (typeof body.costUsd !== "number" || body.costUsd < 0) {
      errors.push("costUsd is required and must be a non-negative number");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Build TaskDecisionEntry
    const tasks = [
      {
        title: body.taskTitle,
        description: body.taskDescription,
        category: body.category,
        urgency: body.urgency,
      },
    ];

    const entry: TaskDecisionEntry = {
      tasksInput: JSON.stringify(tasks),
      energyLevel: body.urgency,
      availableTime: body.availableTime || 60,
      provider: body.provider,
      model: body.model || "unknown",
      result: body.decision,
    };

    await repository.save(entry);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error saving decision:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/history - Search + Pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Validation
    if (page < 1) {
      return NextResponse.json(
        { error: "page must be >= 1" },
        { status: 400 }
      );
    }
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "limit must be between 1 and 100" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    let items;
    let total;

    if (q.trim().length > 0) {
      items = await repository.search(q, limit, offset);
      total = await repository.countBySearch(q);
    } else {
      items = await repository.findAll(limit, offset);
      total = await repository.count();
    }

    return NextResponse.json({
      items,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
