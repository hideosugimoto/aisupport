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
    filename: string,
    mimeType: string,
    sizeBytes: number,
    chunks: { content: string; embedding: number[] }[]
  ): Promise<number>;

  search(queryEmbedding: number[], topK?: number): Promise<VectorSearchResult[]>;

  deleteDocument(documentId: number): Promise<void>;

  listDocuments(): Promise<
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
    filename: string,
    mimeType: string,
    sizeBytes: number,
    chunks: { content: string; embedding: number[] }[]
  ): Promise<number> {
    const doc = await prisma.document.create({
      data: {
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
    queryEmbedding: number[],
    topK: number = ragConfig.top_k
  ): Promise<VectorSearchResult[]> {
    const allChunks = await prisma.documentChunk.findMany({
      take: 1000,
      include: { document: { select: { filename: true } } },
    });

    const scored = allChunks.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      filename: chunk.document.filename,
      similarity: cosineSimilarity(queryEmbedding, bufferToFloat32(Buffer.from(chunk.embedding))),
    }));

    return scored
      .filter((r) => r.similarity >= ragConfig.similarity_threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async deleteDocument(documentId: number): Promise<void> {
    await prisma.document.delete({ where: { id: documentId } });
  }

  async listDocuments() {
    const docs = await prisma.document.findMany({
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
