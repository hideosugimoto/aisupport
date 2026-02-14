/**
 * Vector utility functions for similarity calculations and buffer conversions
 * Shared between RAG and Compass vector stores
 */

export function cosineSimilarity(a: number[], b: Float32Array): number {
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

export function embeddingToBuffer(embedding: number[]): Buffer<ArrayBuffer> {
  const float32 = new Float32Array(embedding);
  return Buffer.from(float32.buffer) as Buffer<ArrayBuffer>;
}

export function bufferToFloat32(buffer: Buffer): Float32Array {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return new Float32Array(arrayBuffer);
}
