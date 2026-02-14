import { prisma } from "../db/prisma";
import { decrypt } from "../crypto/encryption";
import type { LLMProvider } from "../llm/types";

export interface ResolvedKey {
  apiKey: string | undefined;
  source: "user" | "platform";
}

export async function resolveApiKey(
  userId: string,
  provider: LLMProvider
): Promise<ResolvedKey> {
  const userKey = await prisma.userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (userKey) {
    try {
      const apiKey = decrypt(userKey.encryptedKey);
      return { apiKey, source: "user" };
    } catch {
      // Decryption failed — fall back to platform key
      console.warn(`[key-resolver] Failed to decrypt key for ${provider}`);
    }
  }

  return { apiKey: undefined, source: "platform" };
}
