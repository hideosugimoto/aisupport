import type { VisionClient } from "./vision-client";
import compassConfig from "../../../config/compass.json";

export interface ProcessedImage {
  description: string;
  mimeType: string;
}

export function validateImage(
  sizeBytes: number,
  mimeType: string
): { valid: boolean; error?: string } {
  const maxBytes = compassConfig.max_image_size_mb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `画像サイズが${compassConfig.max_image_size_mb}MBを超えています`,
    };
  }
  if (!compassConfig.allowed_image_types.includes(mimeType)) {
    return {
      valid: false,
      error: `対応していない画像形式です（${compassConfig.allowed_image_types.join(", ")}のみ対応）`,
    };
  }
  return { valid: true };
}

export async function processImage(
  imageBase64: string,
  mimeType: string,
  visionClient: VisionClient
): Promise<ProcessedImage> {
  const description = await visionClient.describe(imageBase64, mimeType);
  return { description, mimeType };
}
