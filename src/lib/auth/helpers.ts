import { auth } from "@clerk/nextjs/server";

export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("認証が必要です");
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
