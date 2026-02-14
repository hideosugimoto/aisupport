import type { VisionClient } from "./vision-client";
import compassConfig from "../../../config/compass.json";

export interface ProcessedImage {
  description: string;
  mimeType: string;
}

// Magic byte signatures for allowed image types
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP also has WEBP at offset 8)
};

/**
 * Verify file content matches claimed MIME type via magic bytes.
 */
function verifyMagicBytes(base64Data: string, mimeType: string): boolean {
  const signature = MAGIC_BYTES[mimeType];
  if (!signature) return false;

  try {
    // 24 base64 chars → 18 decoded bytes, enough for longest signature (RIFF+WEBP = 12 bytes)
    const HEADER_B64_LEN = 24;
    const binaryStr = atob(base64Data.slice(0, HEADER_B64_LEN));
    for (let i = 0; i < signature.length; i++) {
      if (binaryStr.charCodeAt(i) !== signature[i]) return false;
    }

    // WebP: additionally check for "WEBP" at offset 8
    if (mimeType === "image/webp") {
      const webpMark = binaryStr.slice(8, 12);
      if (webpMark !== "WEBP") return false;
    }

    return true;
  } catch {
    return false; // Invalid base64 data
  }
}

export function validateImage(
  sizeBytes: number,
  mimeType: string,
  base64Data: string
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
  // Verify magic bytes match claimed Content-Type
  if (base64Data && !verifyMagicBytes(base64Data, mimeType)) {
    return {
      valid: false,
      error: "ファイル内容が指定された画像形式と一致しません",
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
