import type { Embedder } from "../rag/embedder";
import type { PrismaCompassVectorStore } from "./compass-vector-store";
import type { Logger } from "../logger/types";

export interface NeglectedCompass {
  compassItemId: number;
  title: string;
  content: string;
  similarity: number; // lowest similarity = most neglected
}

export interface NeglectDetector {
  detect(userId: string, taskQuery: string): Promise<NeglectedCompass | null>;
}

export class DefaultNeglectDetector implements NeglectDetector {
  constructor(
    private readonly embedder: Embedder,
    private readonly vectorStore: PrismaCompassVectorStore,
    private readonly logger: Logger
  ) {}

  async detect(userId: string, taskQuery: string): Promise<NeglectedCompass | null> {
    // Step 1: Embed the task query
    const queryEmbedding = await this.embedder.embedSingle(taskQuery);

    // Step 2: Search ALL compass items with a high topK
    const results = await this.vectorStore.search(userId, queryEmbedding, 100);

    if (results.length === 0) {
      this.logger.info("No compass embeddings found for user");
      return null;
    }
    this.logger.debug("Found compass chunks", { count: results.length });

    // Step 3: Group by compassItemId, take MAX similarity per item
    const maxSimilarityByItem = new Map<
      number,
      { title: string; content: string; similarity: number }
    >();

    for (const result of results) {
      const existing = maxSimilarityByItem.get(result.documentId);
      if (existing === undefined || result.similarity > existing.similarity) {
        maxSimilarityByItem.set(result.documentId, {
          title: result.filename,
          content: result.content,
          similarity: result.similarity,
        });
      }
    }

    // Step 4: Return the compass item with the LOWEST max similarity (most neglected)
    let mostNeglectedId: number | null = null;
    let lowestSimilarity = Infinity;

    for (const [id, data] of maxSimilarityByItem.entries()) {
      if (data.similarity < lowestSimilarity) {
        lowestSimilarity = data.similarity;
        mostNeglectedId = id;
      }
    }

    if (mostNeglectedId === null) {
      return null;
    }

    const neglected = maxSimilarityByItem.get(mostNeglectedId);
    if (!neglected) {
      return null;
    }
    return {
      compassItemId: mostNeglectedId,
      title: neglected.title,
      content: neglected.content,
      similarity: neglected.similarity,
    };
  }
}
