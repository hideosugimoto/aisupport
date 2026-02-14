import { prisma } from "../db/prisma";
import ragConfig from "../../../config/rag.json";
import { cosineSimilarity, embeddingToBuffer, bufferToFloat32 } from "./vector-utils";

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
    // バッチ処理 + Top-K bounded array でメモリ効率化
    const BATCH_SIZE = 200;
    const topKResults: VectorSearchResult[] = [];
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
          const result: VectorSearchResult = {
            chunkId: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            filename: chunk.document.filename,
            similarity,
          };
          // Top-K bounded insert: 常にtopK件のみ保持
          if (topKResults.length < topK) {
            topKResults.push(result);
            topKResults.sort((a, b) => b.similarity - a.similarity);
          } else if (similarity > topKResults[topKResults.length - 1].similarity) {
            topKResults[topKResults.length - 1] = result;
            topKResults.sort((a, b) => b.similarity - a.similarity);
          }
        }
      }

      cursor = chunks[chunks.length - 1].id;
      if (chunks.length < BATCH_SIZE) break;
    }

    return topKResults;
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
