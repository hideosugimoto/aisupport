import { prisma } from "../db/prisma";
import { decrypt } from "../crypto/encryption";
import type { LLMProvider } from "../llm/types";
import { nullLogger } from "../logger/null-logger";
import type { Logger } from "../logger/types";

export interface ResolvedKey {
  apiKey: string | undefined;
  source: "user" | "platform";
}

export async function resolveApiKey(
  userId: string,
  provider: LLMProvider,
  logger: Logger = nullLogger
): Promise<ResolvedKey> {
  const userKey = await prisma.userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (userKey) {
    try {
      const apiKey = decrypt(userKey.encryptedKey);
      if (!apiKey) {
        logger.warn("Decrypted key is empty, falling back to platform key", { provider });
      } else {
        return { apiKey, source: "user" };
      }
    } catch {
      logger.warn("Failed to decrypt key", { provider });
    }
  }

  return { apiKey: undefined, source: "platform" };
}
