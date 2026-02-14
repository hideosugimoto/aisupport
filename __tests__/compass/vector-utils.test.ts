import { describe, it, expect } from "vitest";
import { cosineSimilarity, embeddingToBuffer, bufferToFloat32 } from "@/lib/rag/vector-utils";

describe("vector-utils", () => {
  describe("cosineSimilarity", () => {
    it("should return 1 for identical vectors", () => {
      const a = [1, 0, 0];
      const b = new Float32Array([1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
    });

    it("should return 0 for orthogonal vectors", () => {
      const a = [1, 0, 0];
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
    });

    it("should return -1 for opposite vectors", () => {
      const a = [1, 0, 0];
      const b = new Float32Array([-1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });

    it("should handle zero vectors", () => {
      const a = [0, 0, 0];
      const b = new Float32Array([1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("should calculate similarity for arbitrary vectors", () => {
      const a = [1, 2, 3];
      const b = new Float32Array([4, 5, 6]);
      // dot = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      // normA = sqrt(1 + 4 + 9) = sqrt(14)
      // normB = sqrt(16 + 25 + 36) = sqrt(77)
      // similarity = 32 / (sqrt(14) * sqrt(77))
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
    });

    it("should handle negative values", () => {
      const a = [1, -1, 0];
      const b = new Float32Array([-1, 1, 0]);
      // dot = 1*(-1) + (-1)*1 + 0*0 = -1 - 1 + 0 = -2
      // normA = sqrt(1 + 1 + 0) = sqrt(2)
      // normB = sqrt(1 + 1 + 0) = sqrt(2)
      // similarity = -2 / (sqrt(2) * sqrt(2)) = -2 / 2 = -1
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });

    it("should handle both zero vectors", () => {
      const a = [0, 0, 0];
      const b = new Float32Array([0, 0, 0]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("should handle high-dimensional vectors", () => {
      const dim = 1536; // OpenAI embedding dimension
      const a = Array(dim)
        .fill(0)
        .map(() => Math.random());
      const b = new Float32Array(a); // Same values = similarity 1
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });
  });

  describe("embeddingToBuffer / bufferToFloat32 round-trip", () => {
    it("should preserve values through round-trip", () => {
      const original = [0.1, 0.5, -0.3, 1.0];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });

    it("should handle empty array", () => {
      const original: number[] = [];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(0);
    });

    it("should handle single value", () => {
      const original = [0.12345];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(1);
      expect(restored[0]).toBeCloseTo(0.12345, 5);
    });

    it("should handle large embedding vectors", () => {
      const original = Array(1536)
        .fill(0)
        .map(() => Math.random() * 2 - 1); // Random values in [-1, 1]
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });

    it("should preserve negative values", () => {
      const original = [-0.5, -1.0, -0.123];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });

    it("should preserve zero values", () => {
      const original = [0, 0, 0, 0];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBe(0);
      }
    });

    it("should preserve extreme values", () => {
      const original = [Number.MAX_VALUE, Number.MIN_VALUE, -Number.MAX_VALUE];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);

      expect(restored.length).toBe(original.length);
      // Note: Float32 has lower precision than Number.MAX_VALUE,
      // so we just check they're very large/small
      expect(Math.abs(restored[0])).toBeGreaterThan(1e30);
      expect(Math.abs(restored[2])).toBeGreaterThan(1e30);
    });

    it("should create buffer of correct byte length", () => {
      const original = [1, 2, 3, 4, 5];
      const buffer = embeddingToBuffer(original);

      // Each float32 is 4 bytes
      expect(buffer.byteLength).toBe(original.length * 4);
    });
  });
});
