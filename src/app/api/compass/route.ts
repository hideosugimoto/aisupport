import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { checkCompassLimit } from "@/lib/billing/plan-gate";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { chunkPlainText } from "@/lib/rag/chunker";
import { embeddingToBuffer } from "@/lib/rag/vector-utils";
import { processUrl } from "@/lib/compass/url-processor";
import { processImage, validateImage } from "@/lib/compass/image-processor";
import { VisionClient } from "@/lib/compass/vision-client";
import { createLLMClient } from "@/lib/llm/client-factory";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import { getDefaultModel } from "@/lib/config/types";

export async function GET() {
  try {
    const userId = await requireAuth();

    const items = await prisma.compassItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        sourceUrl: true,
        imageKey: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    });

    return Response.json({
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        sourceUrl: item.sourceUrl,
        imageKey: item.imageKey,
        createdAt: item.createdAt,
        chunkCount: item._count.chunks,
      })),
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[compass] GET error:", error);
      return Response.json(
        { error: "羅針盤の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const contentType = request.headers.get("content-type") ?? "";
    let type: "text" | "url" | "image";
    let title: string | undefined;
    let content: string;
    let sourceUrl: string | undefined;
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Image upload
      const formData = await request.formData();
      type = "image";
      title = (formData.get("title") as string | null) ?? undefined;
      const file = formData.get("file") as File | null;
      if (!file) {
        return Response.json(
          { error: "画像ファイルが必要です" },
          { status: 400 }
        );
      }
      const validation = validateImage(file.size, file.type);
      if (!validation.valid) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      imageMimeType = file.type;
      content = ""; // Will be set to AI description
    } else {
      // JSON body for text/url
      const body = await request.json();
      type = body.type;
      title = body.title;
      content = body.content ?? "";

      if (!type || !["text", "url"].includes(type)) {
        return Response.json(
          { error: "typeはtext/url/imageのいずれかを指定してください" },
          { status: 400 }
        );
      }
      if (type === "url") {
        sourceUrl = content;
        if (!sourceUrl || !sourceUrl.startsWith("http")) {
          return Response.json(
            { error: "有効なURLを指定してください" },
            { status: 400 }
          );
        }
      }
      if (type === "text" && !content.trim()) {
        return Response.json(
          { error: "テキストを入力してください" },
          { status: 400 }
        );
      }
    }

    // Plan check
    const limitCheck = await checkCompassLimit(userId, type);
    if (!limitCheck.allowed) {
      return Response.json({ error: limitCheck.error }, { status: 403 });
    }

    const embedder = new OpenAIEmbedder();
    let textToEmbed: string;

    if (type === "url") {
      // Process URL
      const { apiKey } = await resolveApiKey(userId, "openai");
      const client = createLLMClient("openai", undefined, false, apiKey);
      const model = getDefaultModel("openai");
      const processed = await processUrl(sourceUrl!, client, model);
      title = title ?? processed.title;
      content = processed.summary;
      textToEmbed = processed.fullText;
    } else if (type === "image") {
      // Process image
      const { apiKey } = await resolveApiKey(userId, "openai");
      const visionClient = new VisionClient(apiKey);
      const processed = await processImage(
        imageBase64!,
        imageMimeType!,
        visionClient
      );
      content = processed.description;
      title = title ?? "画像メモ";
      textToEmbed = processed.description;
    } else {
      // Text
      title = title ?? content.slice(0, 50).trim();
      textToEmbed = content;
    }

    // Chunk and embed
    const chunks = chunkPlainText(textToEmbed);
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    // Save to DB
    const item = await prisma.compassItem.create({
      data: {
        userId,
        type,
        title,
        content,
        sourceUrl: sourceUrl ?? null,
        imageKey: type === "image" ? `compass-${userId}-${Date.now()}` : null,
        chunks: {
          create: chunks.map((chunk, index) => ({
            content: chunk.content,
            chunkIndex: index,
            embedding: embeddingToBuffer(embeddings[index]),
          })),
        },
      },
      include: { _count: { select: { chunks: true } } },
    });

    return Response.json(
      {
        item: {
          id: item.id,
          type: item.type,
          title: item.title,
          content: item.content,
          sourceUrl: item.sourceUrl,
          imageKey: item.imageKey,
          createdAt: item.createdAt,
          chunkCount: item._count.chunks,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[compass] POST error:", error);
      return Response.json(
        { error: "羅針盤アイテムの追加に失敗しました" },
        { status: 500 }
      );
    }
  }
}
