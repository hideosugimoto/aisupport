import OpenAI from "openai";
import ragConfig from "../../../config/rag.json";

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
}

export class OpenAIEmbedder implements Embedder {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Process in batches of 100 (OpenAI limit is 2048)
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: ragConfig.embedding_model,
        input: batch,
        dimensions: ragConfig.embedding_dimensions,
      });

      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }
}
