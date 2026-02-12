import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60 * 1000; // 1分
const MAX_REQUESTS = 10;

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();

// 古いエントリのクリーンアップ（メモリリーク防止）
function cleanup() {
  const now = Date.now();
  for (const [ip, data] of ipRequestMap) {
    if (now > data.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}

// 定期クリーンアップ（5分ごと）
setInterval(cleanup, 5 * 60 * 1000);

export function middleware(request: NextRequest) {
  // API ルートのみ対象
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const now = Date.now();

  const existing = ipRequestMap.get(ip);

  if (!existing || now > existing.resetTime) {
    ipRequestMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (existing.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "リクエスト制限に達しました。しばらく待ってから再試行してください" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((existing.resetTime - now) / 1000)),
        },
      }
    );
  }

  existing.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
