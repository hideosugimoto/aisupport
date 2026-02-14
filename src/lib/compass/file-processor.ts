import type { Embedder } from "../rag/embedder";
import { chunkDocument } from "../rag/chunker";

export async function processFile(
  content: string,
  mimeType: string,
  embedder: Embedder
): Promise<{ chunks: { content: string; embedding: number[] }[] }> {
  const chunks = chunkDocument(content, mimeType);
  const embeddings = await embedder.embed(chunks.map((c) => c.content));
  return {
    chunks: chunks.map((c, i) => ({
      content: c.content,
      embedding: embeddings[i],
    })),
  };
}
