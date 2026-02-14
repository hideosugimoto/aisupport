export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const hex = process.env.API_KEY_ENCRYPTION_KEY;

    if (!hex) {
      console.warn(
        "[instrumentation] API_KEY_ENCRYPTION_KEY is not set — BYOK (user API key) feature will be unavailable"
      );
      return;
    }

    // 鍵が設定されている場合は形式を検証（不正な鍵での起動を防止）
    const { validateEncryptionKey } = await import("@/lib/crypto/encryption");
    validateEncryptionKey();
    console.info("[instrumentation] Encryption key validation passed");
  }
}
