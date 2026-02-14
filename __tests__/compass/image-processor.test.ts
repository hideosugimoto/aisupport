import { describe, it, expect, vi } from "vitest";
import { validateImage, processImage } from "@/lib/compass/image-processor";
import type { VisionClient } from "@/lib/compass/vision-client";

describe("image-processor", () => {
  describe("validateImage", () => {
    it("should accept valid jpeg under size limit", () => {
      const result = validateImage(1024 * 1024, "image/jpeg"); // 1MB
      expect(result.valid).toBe(true);
    });

    it("should reject image over size limit", () => {
      const result = validateImage(6 * 1024 * 1024, "image/jpeg"); // 6MB > 5MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("should reject unsupported mime type", () => {
      const result = validateImage(1024, "image/gif");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("対応していない");
    });

    it("should accept png and webp", () => {
      expect(validateImage(1024, "image/png").valid).toBe(true);
      expect(validateImage(1024, "image/webp").valid).toBe(true);
    });

    it("should accept image exactly at size limit", () => {
      const exactLimit = 5 * 1024 * 1024; // Exactly 5MB
      const result = validateImage(exactLimit, "image/jpeg");
      expect(result.valid).toBe(true);
    });

    it("should reject image just over size limit", () => {
      const justOver = 5 * 1024 * 1024 + 1; // 5MB + 1 byte
      const result = validateImage(justOver, "image/png");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("5MB");
    });

    it("should accept very small images", () => {
      const result = validateImage(100, "image/jpeg");
      expect(result.valid).toBe(true);
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
