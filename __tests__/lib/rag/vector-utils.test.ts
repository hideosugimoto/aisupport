import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  cosineSimilarityPreNorm,
  normalizeVector,
  embeddingToBuffer,
  bufferToFloat32,
} from "@/lib/rag/vector-utils";

describe("vector-utils", () => {
  describe("normalizeVector", () => {
    it("should produce unit vector (norm ≈ 1)", () => {
      const v = [3, 4];
      const normalized = normalizeVector(v);
      const norm = Math.sqrt(normalized.reduce((s, x) => s + x * x, 0));
      expect(norm).toBeCloseTo(1, 10);
    });

    it("should preserve direction", () => {
      const v = [3, 4];
      const normalized = normalizeVector(v);
      // Ratio should be preserved
      expect(normalized[0] / normalized[1]).toBeCloseTo(3 / 4, 10);
    });

    it("should return same array for zero vector", () => {
      const v = [0, 0, 0];
      const result = normalizeVector(v);
      expect(result).toEqual([0, 0, 0]);
    });

    it("should handle single-element vector", () => {
      const v = [5];
      const normalized = normalizeVector(v);
      expect(normalized[0]).toBeCloseTo(1, 10);
    });
  });

  describe("cosineSimilarityPreNorm", () => {
    it("should match cosineSimilarity for same inputs", () => {
      const a = [1, 2, 3, 4, 5];
      const b = new Float32Array([5, 4, 3, 2, 1]);

      const expected = cosineSimilarity(a, b);
      const normalizedA = normalizeVector(a);
      const actual = cosineSimilarityPreNorm(normalizedA, b);

      expect(actual).toBeCloseTo(expected, 6);
    });

    it("should return 1 for identical vectors", () => {
      const a = normalizeVector([1, 1, 1]);
      const b = new Float32Array([1, 1, 1]);
      const result = cosineSimilarityPreNorm(a, b);
      expect(result).toBeCloseTo(1, 6);
    });

    it("should return 0 for orthogonal vectors", () => {
      const a = normalizeVector([1, 0]);
      const b = new Float32Array([0, 1]);
      const result = cosineSimilarityPreNorm(a, b);
      expect(result).toBeCloseTo(0, 6);
    });

    it("should handle zero vector b", () => {
      const a = normalizeVector([1, 2, 3]);
      const b = new Float32Array([0, 0, 0]);
      const result = cosineSimilarityPreNorm(a, b);
      expect(result).toBe(0);
    });
  });

  describe("embeddingToBuffer / bufferToFloat32 roundtrip", () => {
    it("should preserve values through buffer roundtrip", () => {
      const original = [0.1, 0.2, 0.3, -0.5, 1.0];
      const buffer = embeddingToBuffer(original);
      const restored = bufferToFloat32(buffer);
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 5);
      }
    });
  });
});
