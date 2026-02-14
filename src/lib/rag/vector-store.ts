import { prisma } from "../db/prisma";
import ragConfig from "../../../config/rag.json";

export interface VectorSearchResult {
  chunkId: number;
  documentId: number;
  content: string;
  similarity: number;
  filename: string;
}

export interface VectorStore {
  addDocument(
    userId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number,
    chunks: { content: string; embedding: number[] }[]
  ): Promise<number>;

  search(userId: string, queryEmbedding: number[], topK?: number): Promise<VectorSearchResult[]>;

  deleteDocument(userId: string, documentId: number): Promise<void>;

  listDocuments(userId: string): Promise<
    { id: number; filename: string; mimeType: string; chunkCount: number; createdAt: Date }[]
  >;
}

function cosineSimilarity(a: number[], b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function embeddingToBuffer(embedding: number[]): Buffer<ArrayBuffer> {
  const float32 = new Float32Array(embedding);
  return Buffer.from(float32.buffer) as Buffer<ArrayBuffer>;
}

function bufferToFloat32(buffer: Buffer): Float32Array {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return new Float32Array(arrayBuffer);
}

export class PrismaVectorStore implements VectorStore {
  async addDocument(
    userId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number,
    chunks: { content: string; embedding: number[] }[]
  ): Promise<number> {
    const doc = await prisma.document.create({
      data: {
        userId,
        filename,
        mimeType,
        sizeBytes,
        chunks: {
          create: chunks.map((chunk, index) => ({
            content: chunk.content,
            chunkIndex: index,
            embedding: embeddingToBuffer(chunk.embedding),
          })),
        },
      },
    });
    return doc.id;
  }

  async search(
    userId: string,
    queryEmbedding: number[],
    topK: number = ragConfig.top_k
  ): Promise<VectorSearchResult[]> {
    // バッチ処理でメモリ使用量を制限（1バッチ200件）
    const BATCH_SIZE = 200;
    const results: VectorSearchResult[] = [];
    let cursor: number | undefined;

    for (;;) {
      const chunks = await prisma.documentChunk.findMany({
        where: { document: { userId } },
        take: BATCH_SIZE,
        ...(cursor != null ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        include: { document: { select: { filename: true } } },
      });

      if (chunks.length === 0) break;

      for (const chunk of chunks) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          bufferToFloat32(Buffer.from(chunk.embedding))
        );
        if (similarity >= ragConfig.similarity_threshold) {
          results.push({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            filename: chunk.document.filename,
            similarity,
          });
        }
      }

      cursor = chunks[chunks.length - 1].id;
      if (chunks.length < BATCH_SIZE) break;
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async deleteDocument(userId: string, documentId: number): Promise<void> {
    await prisma.document.delete({ where: { id: documentId, userId } });
  }

  async listDocuments(userId: string) {
    const docs = await prisma.document.findMany({
      where: { userId },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      chunkCount: d._count.chunks,
      createdAt: d.createdAt,
    }));
  }
}
