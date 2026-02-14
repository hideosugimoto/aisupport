import { prisma } from "../db/prisma";
import { cosineSimilarity, bufferToFloat32 } from "../rag/vector-utils";
import type { VectorSearchResult } from "../rag/vector-store";
import compassConfig from "../../../config/compass.json";

export class PrismaCompassVectorStore {
  async search(
    userId: string,
    queryEmbedding: number[],
    topK: number = compassConfig.compass_top_k
  ): Promise<VectorSearchResult[]> {
    // Same batch + Top-K bounded pattern as PrismaVectorStore
    // but queries compassChunk table instead of documentChunk
    const BATCH_SIZE = 200;
    const topKResults: VectorSearchResult[] = [];
    let cursor: number | undefined;

    for (;;) {
      const chunks = await prisma.compassChunk.findMany({
        where: { compassItem: { userId } },
        take: BATCH_SIZE,
        ...(cursor != null ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        include: { compassItem: { select: { title: true } } },
      });

      if (chunks.length === 0) break;

      for (const chunk of chunks) {
        const similarity = cosineSimilarity(
          queryEmbedding,
          bufferToFloat32(Buffer.from(chunk.embedding))
        );
        if (similarity >= compassConfig.compass_similarity_threshold) {
          const result: VectorSearchResult = {
            chunkId: chunk.id,
            documentId: chunk.compassItemId,
            content: chunk.content,
            filename: chunk.compassItem.title,
            similarity,
          };
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
}
