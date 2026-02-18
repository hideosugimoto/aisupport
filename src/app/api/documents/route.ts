import { NextRequest } from "next/server";
import { PrismaVectorStore } from "@/lib/rag/vector-store";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { chunkDocument } from "@/lib/rag/chunker";
import ragConfig from "../../../../config/rag.json";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { getUserPlan } from "@/lib/billing/plan-gate";

function sanitizeFilename(filename: string): string {
  // パストラバーサル除去
  const basename = filename.replace(/^.*[\\\/]/, "");
  // ヌルバイト除去
  const noNull = basename.replace(/\0/g, "");
  // 安全な文字のみ許可
  const safe = noNull.replace(/[^\p{L}\p{N}._-]/gu, "_");
  // 連続ピリオド禁止（パストラバーサル対策）
  const noDots = safe.replace(/\.{2,}/g, "_");
  // 先頭ピリオド禁止（隠しファイル防止）
  const noLeadingDot = noDots.replace(/^\.+/, "");
  return noLeadingDot.slice(0, 255) || "unnamed";
}

const vectorStore = new PrismaVectorStore();

export async function GET() {
  try {
    const userId = await requireAuth();
    const documents = await vectorStore.listDocuments(userId);
    return Response.json({ documents });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[documents/GET]", error);
      return Response.json(
        { error: "ドキュメント一覧の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const plan = await getUserPlan(userId);
    if (!plan.ragEnabled) {
      return Response.json(
        { error: "ドキュメントアップロードはProプランで利用できます" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    const maxBytes = ragConfig.max_document_size_mb * 1024 * 1024;
    if (file.size > maxBytes) {
      return Response.json(
        { error: `ファイルサイズが${ragConfig.max_document_size_mb}MBを超えています` },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "text/markdown",
      "text/x-markdown",
      "text/plain",
      "application/pdf",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    let mimeType = file.type || "text/plain";
    if (ext === "md") mimeType = "text/markdown";
    if (!allowedTypes.includes(mimeType) && ext !== "md" && ext !== "txt" && ext !== "pdf") {
      return Response.json(
        { error: "対応形式: Markdown (.md), テキスト (.txt), PDF (.pdf)" },
        { status: 400 }
      );
    }

    let textContent: string;

    if (mimeType === "application/pdf" || ext === "pdf") {
      // pdf-parse のメインエントリはテスト用PDFを読み込むため、lib を直接参照
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await pdfParse(buffer);
      textContent = result.text;
      mimeType = "application/pdf";
    } else {
      textContent = await file.text();
    }

    if (!textContent.trim()) {
      return Response.json(
        { error: "ファイルの内容が空です" },
        { status: 400 }
      );
    }

    const chunks = chunkDocument(textContent, mimeType);

    if (chunks.length === 0) {
      return Response.json(
        { error: "チャンクが生成できませんでした" },
        { status: 400 }
      );
    }

    const embedder = new OpenAIEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    const safeName = sanitizeFilename(file.name);
    const documentId = await vectorStore.addDocument(
      userId,
      safeName,
      mimeType,
      file.size,
      chunks.map((c, i) => ({
        content: c.content,
        embedding: embeddings[i],
      }))
    );

    return Response.json({
      id: documentId,
      filename: safeName,
      chunkCount: chunks.length,
    });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[documents/POST]", error);
      return Response.json(
        { error: "アップロード処理中にエラーが発生しました" },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "IDが必要です" }, { status: 400 });
    }

    await vectorStore.deleteDocument(userId, Number(id));
    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[documents/DELETE]", error);
      return Response.json(
        { error: "削除処理中にエラーが発生しました" },
        { status: 500 }
      );
    }
  }
}
