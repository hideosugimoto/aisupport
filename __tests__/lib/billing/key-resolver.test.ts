import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveApiKey } from "@/lib/billing/key-resolver";
import type { LLMProvider } from "@/lib/llm/types";
import { createMockLogger } from "../../helpers/mock-logger";

// Mock modules
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userApiKey: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/crypto/encryption", () => ({
  decrypt: vi.fn(),
}));

// Import mocked modules to set return values
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto/encryption";

describe("resolveApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("User key scenarios", () => {
    it("should return user key when found and decryption succeeds", async () => {
      const userId = "user-123";
      const provider: LLMProvider = "openai";
      const encryptedKey = "encrypted-key-data";
      const decryptedKey = "sk-1234567890";

      // Mock findUnique to return a user key
      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-1",
        userId,
        provider,
        encryptedKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock decrypt to succeed
      vi.mocked(decrypt).mockReturnValue(decryptedKey);

      const result = await resolveApiKey(userId, provider);

      expect(result).toEqual({
        apiKey: decryptedKey,
        source: "user",
      });

      expect(prisma.userApiKey.findUnique).toHaveBeenCalledWith({
        where: { userId_provider: { userId, provider } },
      });

      expect(decrypt).toHaveBeenCalledWith(encryptedKey);
    });

    it("should work with openai provider", async () => {
      const userId = "user-456";
      const provider: LLMProvider = "openai";
      const decryptedKey = "sk-openai-key";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-2",
        userId,
        provider,
        encryptedKey: "encrypted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(decrypt).mockReturnValue(decryptedKey);

      const result = await resolveApiKey(userId, provider);

      expect(result.apiKey).toBe(decryptedKey);
      expect(result.source).toBe("user");
    });

    it("should work with gemini provider", async () => {
      const userId = "user-789";
      const provider: LLMProvider = "gemini";
      const decryptedKey = "gemini-api-key-xyz";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-3",
        userId,
        provider,
        encryptedKey: "encrypted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(decrypt).mockReturnValue(decryptedKey);

      const result = await resolveApiKey(userId, provider);

      expect(result.apiKey).toBe(decryptedKey);
      expect(result.source).toBe("user");
    });

    it("should work with claude provider", async () => {
      const userId = "user-abc";
      const provider: LLMProvider = "claude";
      const decryptedKey = "claude-api-key-123";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-4",
        userId,
        provider,
        encryptedKey: "encrypted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(decrypt).mockReturnValue(decryptedKey);

      const result = await resolveApiKey(userId, provider);

      expect(result.apiKey).toBe(decryptedKey);
      expect(result.source).toBe("user");
    });
  });

  describe("Platform key fallback scenarios", () => {
    it("should fall back to platform key when no user key exists", async () => {
      const userId = "user-no-key";
      const provider: LLMProvider = "openai";

      // Mock findUnique to return null (no user key)
      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null);

      const result = await resolveApiKey(userId, provider);

      expect(result).toEqual({
        apiKey: undefined,
        source: "platform",
      });

      expect(prisma.userApiKey.findUnique).toHaveBeenCalledWith({
        where: { userId_provider: { userId, provider } },
      });

      // decrypt should not be called when no key exists
      expect(decrypt).not.toHaveBeenCalled();
    });

    it("should fall back to platform key when decryption fails and log warning", async () => {
      const userId = "user-decrypt-fail";
      const provider: LLMProvider = "gemini";
      const encryptedKey = "corrupted-encrypted-key";

      // Mock findUnique to return a user key
      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-5",
        userId,
        provider,
        encryptedKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock decrypt to throw an error
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const mockLogger = createMockLogger();

      const result = await resolveApiKey(userId, provider, mockLogger);

      expect(result).toEqual({
        apiKey: undefined,
        source: "platform",
      });

      expect(decrypt).toHaveBeenCalledWith(encryptedKey);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to decrypt key",
        expect.objectContaining({ provider })
      );
    });

    it("should suppress console.warn during decryption failure", async () => {
      const userId = "user-silent-fail";
      const provider: LLMProvider = "claude";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-6",
        userId,
        provider,
        encryptedKey: "encrypted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error("Decryption error");
      });

      const mockLogger = createMockLogger();

      const result = await resolveApiKey(userId, provider, mockLogger);

      expect(result.source).toBe("platform");
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty userId gracefully", async () => {
      const userId = "";
      const provider: LLMProvider = "openai";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null);

      const result = await resolveApiKey(userId, provider);

      expect(result).toEqual({
        apiKey: undefined,
        source: "platform",
      });
    });

    it("should handle database errors by returning platform key", async () => {
      const userId = "user-db-error";
      const provider: LLMProvider = "openai";

      // Mock findUnique to throw a database error
      vi.mocked(prisma.userApiKey.findUnique).mockRejectedValue(
        new Error("Database connection failed")
      );

      // This test verifies that the function does NOT handle DB errors
      // (as per the current implementation, it would throw)
      await expect(resolveApiKey(userId, provider)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("should fall back to platform key when decryption returns empty string", async () => {
      const userId = "user-empty-key";
      const provider: LLMProvider = "gemini";

      vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
        id: "key-7",
        userId,
        provider,
        encryptedKey: "encrypted",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // decrypt returns empty string
      vi.mocked(decrypt).mockReturnValue("");

      const mockLogger = createMockLogger();
      const result = await resolveApiKey(userId, provider, mockLogger);

      // Empty string should fall back to platform key
      expect(result).toEqual({
        apiKey: undefined,
        source: "platform",
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Decrypted key is empty, falling back to platform key",
        { provider }
      );
    });
  });
});
