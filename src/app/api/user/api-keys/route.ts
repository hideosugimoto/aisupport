import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { encrypt, createKeyHint } from "@/lib/crypto/encryption";

const VALID_PROVIDERS = new Set(["openai", "gemini", "claude"]);

export async function GET() {
  try {
    const userId = await requireAuth();

    const keys = await prisma.userApiKey.findMany({
      where: { userId },
      select: {
        provider: true,
        keyHint: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ keys });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json(
        { error: "APIキー一覧の取得に失敗しました" },
        { status: 500 }
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !VALID_PROVIDERS.has(provider)) {
      return Response.json(
        { error: "無効なプロバイダーです（openai, gemini, claude）" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10 || apiKey.trim().length > 256) {
      return Response.json(
        { error: "有効なAPIキーを入力してください（10〜256文字）" },
        { status: 400 }
      );
    }

    const encryptedKey = encrypt(apiKey.trim());
    const keyHint = createKeyHint(apiKey.trim());

    await prisma.userApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: { encryptedKey, keyHint },
      create: { userId, provider, encryptedKey, keyHint },
    });

    return Response.json({ provider, keyHint });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      console.error("[user/api-keys/POST]", error instanceof Error ? error.message : String(error));
      return Response.json(
        { error: "APIキーの保存に失敗しました" },
        { status: 500 }
      );
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider || !VALID_PROVIDERS.has(provider)) {
      return Response.json(
        { error: "無効なプロバイダーです" },
        { status: 400 }
      );
    }

    await prisma.userApiKey.deleteMany({
      where: { userId, provider },
    });

    return Response.json({ success: true });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return Response.json(
        { error: "APIキーの削除に失敗しました" },
        { status: 500 }
      );
    }
  }
}
