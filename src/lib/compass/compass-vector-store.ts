import { prisma } from "../db/prisma";
import { cosineSimilarityPreNorm, normalizeVector, bufferToFloat32 } from "../rag/vector-utils";
import type { VectorSearchResult } from "../rag/vector-store";
import compassConfig from "../../../config/compass.json";

export class PrismaCompassVectorStore {
  async search(
    userId: string,
    queryEmbedding: number[],
    topK: number = compassConfig.compass_top_k
  ): Promise<VectorSearchResult[]> {
    // Pre-normalize query vector to avoid redundant norm calculation per chunk
    const normalizedQuery = normalizeVector(queryEmbedding);
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
        const similarity = cosineSimilarityPreNorm(
          normalizedQuery,
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
          // Top-K bounded insert with bubble-up (O(K) vs O(K log K) sort)
          if (topKResults.length < topK) {
            topKResults.push(result);
            if (topKResults.length === topK) {
              topKResults.sort((a, b) => b.similarity - a.similarity);
            }
          } else if (similarity > topKResults[topKResults.length - 1].similarity) {
            topKResults[topKResults.length - 1] = result;
            for (let i = topKResults.length - 1; i > 0; i--) {
              if (topKResults[i].similarity > topKResults[i - 1].similarity) {
                [topKResults[i], topKResults[i - 1]] = [topKResults[i - 1], topKResults[i]];
              } else break;
            }
          }
        }
      }

      cursor = chunks[chunks.length - 1].id;
      if (chunks.length < BATCH_SIZE) break;
    }

    topKResults.sort((a, b) => b.similarity - a.similarity);
    return topKResults;
  }
}
