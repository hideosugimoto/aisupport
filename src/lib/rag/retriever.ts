import type { Embedder } from "./embedder";
import type { VectorStore, VectorSearchResult } from "./vector-store";
import ragConfig from "../../../config/rag.json";

export interface RetrievalResult {
  results: VectorSearchResult[];
  contextText: string;
}

export interface Retriever {
  retrieve(query: string, topK?: number): Promise<RetrievalResult>;
  buildContextSection(results: VectorSearchResult[]): string;
}

export class DefaultRetriever implements Retriever {
  constructor(
    private embedder: Embedder,
    private vectorStore: VectorStore
  ) {}

  async retrieve(
    query: string,
    topK: number = ragConfig.top_k
  ): Promise<RetrievalResult> {
    const queryEmbedding = await this.embedder.embedSingle(query);
    const results = await this.vectorStore.search(queryEmbedding, topK);
    const contextText = this.buildContextSection(results);
    return { results, contextText };
  }

  buildContextSection(results: VectorSearchResult[]): string {
    if (results.length === 0) return "";

    const sections = results.map(
      (r, i) =>
        `[参考${i + 1}: ${r.filename} (類似度: ${(r.similarity * 100).toFixed(0)}%)]\n${r.content}`
    );

    return (
      "## 関連する参考情報\n\n" +
      "以下はアップロードされたドキュメントから検索された関連情報です。判断の参考にしてください。\n\n" +
      sections.join("\n\n---\n\n")
    );
  }
}
