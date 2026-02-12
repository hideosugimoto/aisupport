import { NextRequest } from "next/server";
import { PrismaVectorStore } from "@/lib/rag/vector-store";
import { OpenAIEmbedder } from "@/lib/rag/embedder";
import { chunkDocument } from "@/lib/rag/chunker";
import ragConfig from "../../../../config/rag.json";

function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/^.*[\\\/]/, "");
  return basename.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 255);
}

const vectorStore = new PrismaVectorStore();

export async function GET() {
  try {
    const documents = await vectorStore.listDocuments();
    return Response.json({ documents });
  } catch (error) {
    console.error("[documents/GET]", error);
    return Response.json(
      { error: "ドキュメント一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    // Validate file size
    const maxBytes = ragConfig.max_document_size_mb * 1024 * 1024;
    if (file.size > maxBytes) {
      return Response.json(
        { error: `ファイルサイズが${ragConfig.max_document_size_mb}MBを超えています` },
        { status: 400 }
      );
    }

    // Validate file type
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
      // PDF parsing
      const { PDFParse } = await import("pdf-parse");
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
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

    // Chunk the document
    const chunks = chunkDocument(textContent, mimeType);

    if (chunks.length === 0) {
      return Response.json(
        { error: "チャンクが生成できませんでした" },
        { status: 400 }
      );
    }

    // Generate embeddings
    const embedder = new OpenAIEmbedder();
    const embeddings = await embedder.embed(chunks.map((c) => c.content));

    // Store in vector store
    const safeName = sanitizeFilename(file.name);
    const documentId = await vectorStore.addDocument(
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
    console.error("[documents/POST]", error);
    return Response.json(
      { error: "アップロード処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "IDが必要です" }, { status: 400 });
    }

    await vectorStore.deleteDocument(Number(id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("[documents/DELETE]", error);
    return Response.json(
      { error: "削除処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
