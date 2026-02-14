import { describe, it, expect, vi } from "vitest";
import { validateImage, processImage } from "@/lib/compass/image-processor";
import type { VisionClient } from "@/lib/compass/vision-client";

// Valid magic byte headers encoded as base64
const JPEG_MAGIC_B64 = btoa(String.fromCharCode(0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10));
const PNG_MAGIC_B64 = btoa(String.fromCharCode(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00));
const WEBP_MAGIC_B64 = btoa(String.fromCharCode(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50));

describe("image-processor", () => {
  describe("validateImage", () => {
    it("should accept valid jpeg under size limit", () => {
      const result = validateImage(1024 * 1024, "image/jpeg", JPEG_MAGIC_B64); // 1MB
      expect(result.valid).toBe(true);
    });

    it("should reject image over size limit", () => {
      const result = validateImage(6 * 1024 * 1024, "image/jpeg", JPEG_MAGIC_B64); // 6MB > 5MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("should reject unsupported mime type", () => {
      const result = validateImage(1024, "image/gif", "R0lGODlh");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("対応していない");
    });

    it("should accept png and webp", () => {
      expect(validateImage(1024, "image/png", PNG_MAGIC_B64).valid).toBe(true);
      expect(validateImage(1024, "image/webp", WEBP_MAGIC_B64).valid).toBe(true);
    });

    it("should accept image exactly at size limit", () => {
      const exactLimit = 5 * 1024 * 1024; // Exactly 5MB
      const result = validateImage(exactLimit, "image/jpeg", JPEG_MAGIC_B64);
      expect(result.valid).toBe(true);
    });

    it("should reject image just over size limit", () => {
      const justOver = 5 * 1024 * 1024 + 1; // 5MB + 1 byte
      const result = validateImage(justOver, "image/png", PNG_MAGIC_B64);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("should accept very small images", () => {
      const result = validateImage(100, "image/jpeg", JPEG_MAGIC_B64);
      expect(result.valid).toBe(true);
    });

    it("should reject magic byte mismatch (jpeg header with png mime)", () => {
      const result = validateImage(1024, "image/png", JPEG_MAGIC_B64);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("一致しません");
    });

    it("should reject invalid base64 data gracefully", () => {
      const result = validateImage(1024, "image/jpeg", "!!!invalid-base64!!!");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("一致しません");
    });

    it("should reject RIFF non-WebP with webp mime", () => {
      // RIFF header but with "AVI " instead of "WEBP"
      const aviBase64 = btoa(String.fromCharCode(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20));
      const result = validateImage(1024, "image/webp", aviBase64);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("一致しません");
    });
  });

  describe("processImage", () => {
    it("should return description from vision client", async () => {
      const mockVisionClient = {
        describe: vi.fn().mockResolvedValue("海辺の美しい景色。旅行の夢を表現しています。"),
      } as unknown as VisionClient;

      const result = await processImage("base64data", "image/jpeg", mockVisionClient);

      expect(result.description).toBe("海辺の美しい景色。旅行の夢を表現しています。");
      expect(result.mimeType).toBe("image/jpeg");
      expect(mockVisionClient.describe).toHaveBeenCalledWith("base64data", "image/jpeg");
    });

    it("should handle different mime types", async () => {
      const mockVisionClient = {
        describe: vi.fn().mockResolvedValue("ビジョンボードの画像"),
      } as unknown as VisionClient;

      const result = await processImage("pngdata", "image/png", mockVisionClient);

      expect(result.description).toBe("ビジョンボードの画像");
      expect(result.mimeType).toBe("image/png");
      expect(mockVisionClient.describe).toHaveBeenCalledWith("pngdata", "image/png");
    });

    it("should preserve mimeType in result", async () => {
      const mockVisionClient = {
        describe: vi.fn().mockResolvedValue("画像の説明"),
      } as unknown as VisionClient;

      const resultJpeg = await processImage("data1", "image/jpeg", mockVisionClient);
      const resultPng = await processImage("data2", "image/png", mockVisionClient);
      const resultWebp = await processImage("data3", "image/webp", mockVisionClient);

      expect(resultJpeg.mimeType).toBe("image/jpeg");
      expect(resultPng.mimeType).toBe("image/png");
      expect(resultWebp.mimeType).toBe("image/webp");
    });
  });
});
