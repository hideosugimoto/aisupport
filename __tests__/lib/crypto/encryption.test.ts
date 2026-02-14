import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, createKeyHint } from "@/lib/crypto/encryption";

describe("encryption module", () => {
  const VALID_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.API_KEY_ENCRYPTION_KEY;
    process.env.API_KEY_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.API_KEY_ENCRYPTION_KEY;
    } else {
      process.env.API_KEY_ENCRYPTION_KEY = originalEnv;
    }
  });

  describe("encrypt and decrypt round trip", () => {
    it("should encrypt and decrypt simple text correctly", () => {
      const plaintext = "Hello, World!";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt empty string", () => {
      const plaintext = "";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt special characters", () => {
      const plaintext = "Special: 日本語, emoji 🎉, newline\n, tab\t";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt long text", () => {
      const plaintext = "a".repeat(10000);
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", () => {
      const plaintext = "Same text";
      const ciphertext1 = encrypt(plaintext);
      const ciphertext2 = encrypt(plaintext);

      expect(ciphertext1).not.toBe(ciphertext2);
      expect(decrypt(ciphertext1)).toBe(plaintext);
      expect(decrypt(ciphertext2)).toBe(plaintext);
    });

    it("should have correct ciphertext format (iv:tag:encrypted)", () => {
      const plaintext = "Test";
      const ciphertext = encrypt(plaintext);
      const parts = ciphertext.split(":");

      expect(parts).toHaveLength(3);
      // IV should be 12 bytes -> 16 base64 chars
      expect(Buffer.from(parts[0], "base64").length).toBe(12);
      // Tag should be 16 bytes -> ~22 base64 chars
      expect(Buffer.from(parts[1], "base64").length).toBe(16);
      // Encrypted data should be non-empty
      expect(Buffer.from(parts[2], "base64").length).toBeGreaterThan(0);
    });
  });

  describe("invalid encryption key", () => {
    it("should throw error when encryption key is missing", () => {
      delete process.env.API_KEY_ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
      );
    });

    it("should throw error when encryption key is too short", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "0123456789abcdef";

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
      );
    });

    it("should throw error when encryption key is too long", () => {
      process.env.API_KEY_ENCRYPTION_KEY = VALID_KEY + "00";

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
      );
    });

    it("should throw error when encryption key contains invalid hex characters", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "g123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY contains invalid hex characters"
      );
    });

    it("should throw error when encryption key contains spaces", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "0123456789abcdef 123456789abcdef0123456789abcdef0123456789abcdef";

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY contains invalid hex characters"
      );
    });

    it("should throw error when encryption key contains special characters", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "0123456789abcdef!123456789abcdef0123456789abcdef0123456789abcdef";

      expect(() => encrypt("test")).toThrow(
        "API_KEY_ENCRYPTION_KEY contains invalid hex characters"
      );
    });

    it("should accept both lowercase and uppercase hex characters", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

      const plaintext = "test";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should accept mixed case hex characters", () => {
      process.env.API_KEY_ENCRYPTION_KEY = "0123456789AbCdEf0123456789aBcDeF0123456789AbCdEf0123456789aBcDeF";

      const plaintext = "test";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("invalid ciphertext format", () => {
    it("should throw error when ciphertext has wrong number of parts (too few)", () => {
      const invalidCiphertext = "part1:part2";

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid ciphertext format"
      );
    });

    it("should throw error when ciphertext has wrong number of parts (too many)", () => {
      const invalidCiphertext = "part1:part2:part3:part4";

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid ciphertext format"
      );
    });

    it("should throw error when ciphertext has no colons", () => {
      const invalidCiphertext = "notvalidbase64data";

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid ciphertext format"
      );
    });

    it("should throw error when IV length is invalid (too short)", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Replace IV with shorter one (8 bytes instead of 12)
      const shortIV = Buffer.from("12345678", "utf8").toString("base64");
      const invalidCiphertext = [shortIV, parts[1], parts[2]].join(":");

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid IV length"
      );
    });

    it("should throw error when IV length is invalid (too long)", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Replace IV with longer one (16 bytes instead of 12)
      const longIV = Buffer.from("1234567890123456", "utf8").toString("base64");
      const invalidCiphertext = [longIV, parts[1], parts[2]].join(":");

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid IV length"
      );
    });

    it("should throw error when auth tag length is invalid (too short)", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Replace tag with shorter one (8 bytes instead of 16)
      const shortTag = Buffer.from("12345678", "utf8").toString("base64");
      const invalidCiphertext = [parts[0], shortTag, parts[2]].join(":");

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid auth tag length"
      );
    });

    it("should throw error when auth tag length is invalid (too long)", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Replace tag with longer one (20 bytes instead of 16)
      const longTag = Buffer.from("12345678901234567890", "utf8").toString("base64");
      const invalidCiphertext = [parts[0], longTag, parts[2]].join(":");

      expect(() => decrypt(invalidCiphertext)).toThrow(
        "Invalid auth tag length"
      );
    });

    it("should throw error when auth tag is tampered", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Tamper with the tag
      const tamperedTagBuffer = Buffer.from(parts[1], "base64");
      tamperedTagBuffer[0] = tamperedTagBuffer[0] ^ 0xFF; // Flip bits
      const tamperedTag = tamperedTagBuffer.toString("base64");
      const tamperedCiphertext = [parts[0], tamperedTag, parts[2]].join(":");

      expect(() => decrypt(tamperedCiphertext)).toThrow();
    });

    it("should throw error when encrypted data is tampered", () => {
      // Create valid ciphertext first
      const validCiphertext = encrypt("test");
      const parts = validCiphertext.split(":");

      // Tamper with the encrypted data
      const tamperedDataBuffer = Buffer.from(parts[2], "base64");
      if (tamperedDataBuffer.length > 0) {
        tamperedDataBuffer[0] = tamperedDataBuffer[0] ^ 0xFF; // Flip bits
      }
      const tamperedData = tamperedDataBuffer.toString("base64");
      const tamperedCiphertext = [parts[0], parts[1], tamperedData].join(":");

      expect(() => decrypt(tamperedCiphertext)).toThrow();
    });
  });

  describe("createKeyHint", () => {
    it("should mask short API keys (6 chars or less)", () => {
      expect(createKeyHint("abc")).toBe("***");
      expect(createKeyHint("123456")).toBe("***");
      expect(createKeyHint("a")).toBe("***");
      expect(createKeyHint("")).toBe("***");
    });

    it("should show first 3 and last 3 characters for normal keys", () => {
      expect(createKeyHint("sk-1234567890abcdef")).toBe("sk-...def");
      expect(createKeyHint("abcdefghijklmnop")).toBe("abc...nop");
    });

    it("should handle exactly 7 character keys", () => {
      expect(createKeyHint("abcdefg")).toBe("abc...efg");
    });

    it("should handle very long keys", () => {
      const longKey = "sk-proj-" + "a".repeat(100) + "xyz";
      expect(createKeyHint(longKey)).toBe("sk-...xyz");
    });

    it("should handle keys with special characters", () => {
      expect(createKeyHint("sk-proj-abc123_xyz")).toBe("sk-...xyz");
    });

    it("should handle unicode characters", () => {
      expect(createKeyHint("abc日本語xyz")).toBe("abc...xyz");
    });
  });

  describe("edge cases", () => {
    it("should handle sensitive data encryption", () => {
      const sensitiveData = JSON.stringify({
        apiKey: "sk-1234567890",
        password: "secret123",
        token: "bearer-token-xyz"
      });

      const ciphertext = encrypt(sensitiveData);
      const decrypted = decrypt(ciphertext);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(sensitiveData));
      expect(ciphertext).not.toContain("sk-1234567890");
      expect(ciphertext).not.toContain("secret123");
    });

    it("should handle numeric strings", () => {
      const plaintext = "1234567890";
      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle JSON data", () => {
      const jsonData = JSON.stringify({ key: "value", nested: { data: 123 } });
      const ciphertext = encrypt(jsonData);
      const decrypted = decrypt(ciphertext);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual({ key: "value", nested: { data: 123 } });
    });
  });
});
