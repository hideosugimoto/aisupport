import { LLMError } from "@/lib/llm/errors";

export function formatError(error: unknown): {
  error: string;
  code?: string;
  status: number;
} {
  if (error instanceof LLMError) {
    const statusMap: Record<string, number> = {
      RATE_LIMITED: 429,
      AUTH_FAILED: 401,
      TIMEOUT: 504,
      SERVER_ERROR: 502,
      NETWORK_ERROR: 503,
    };
    const userMessageMap: Record<string, string> = {
      RATE_LIMITED: "リクエスト制限に達しました。しばらく待ってから再試行してください",
      AUTH_FAILED: "AIエンジンの認証に失敗しました",
      TIMEOUT: "リクエストがタイムアウトしました",
      SERVER_ERROR: "AIエンジンでエラーが発生しました",
      NETWORK_ERROR: "ネットワークエラーが発生しました",
    };
    return {
      error: userMessageMap[error.code] ?? "エラーが発生しました",
      code: error.code,
      status: statusMap[error.code] ?? 500,
    };
  }
  return {
    error: "内部エラーが発生しました",
    status: 500,
  };
}
