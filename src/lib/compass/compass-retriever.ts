import type { Embedder } from "../rag/embedder";
import type { Retriever, RetrievalResult } from "../rag/retriever";
import type { VectorSearchResult } from "../rag/vector-store";
import type { PrismaCompassVectorStore } from "./compass-vector-store";
import compassConfig from "../../../config/compass.json";

export class CompassRetriever implements Retriever {
  constructor(
    private embedder: Embedder,
    private compassVectorStore: PrismaCompassVectorStore
  ) {}

  async retrieve(
    userId: string,
    query: string,
    topK: number = compassConfig.compass_top_k
  ): Promise<RetrievalResult> {
    const queryEmbedding = await this.embedder.embedSingle(query);
    const results = await this.compassVectorStore.search(userId, queryEmbedding, topK);
    const contextText = this.buildContextSection(results);
    return { results, contextText };
  }

  buildContextSection(results: VectorSearchResult[]): string {
    if (results.length === 0) return "";

    const sections = results.map(
      (r, i) =>
        `[羅針盤${i + 1}: ${r.filename} (関連度: ${(r.similarity * 100).toFixed(0)}%)]\n${r.content}`
    );

    return (
      "## あなたの羅針盤（目標・夢・インスピレーション）\n\n" +
      "以下はあなたが登録した目標や夢に関連する情報です。今日のタスク選定の指針にしてください。\n\n" +
      sections.join("\n\n---\n\n")
    );
  }
}
