import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("認証が必要です");
  }

  // 停止ユーザーチェック
  const status = await prisma.userStatus.findUnique({
    where: { userId },
    select: { suspended: true },
  });
  if (status?.suspended) {
    throw new AuthError("アカウントが停止されています。サポートにお問い合わせください。");
  }

  return userId;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function handleAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  throw error;
}
