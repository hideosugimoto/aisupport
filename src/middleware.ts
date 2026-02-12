import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60 * 1000; // 1分
const MAX_REQUESTS = 10;
const CLEANUP_INTERVAL = 100; // 100リクエストごとにクリーンアップ
const MAX_MAP_SIZE = 10000; // Map サイズ上限（DoS 防御）

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
let requestCount = 0;

// 古いエントリのクリーンアップ（遅延実行でメモリリーク防止）
function lazyCleanup() {
  const now = Date.now();

  // Map サイズ上限を超えたら全クリア（DoS 防御）
  if (ipRequestMap.size > MAX_MAP_SIZE) {
    ipRequestMap.clear();
    requestCount = 0;
    return;
  }

  // 期限切れエントリのみ削除
  for (const [ip, data] of ipRequestMap) {
    if (now > data.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}

// 信頼できる IP を取得（スプーフィング対策）
function getClientIP(request: NextRequest): string {
  // 1. x-forwarded-for の最後のエントリ（プロキシに最も近い IP）を使用
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    return ips[ips.length - 1] || "unknown";
  }

  // 3. x-real-ip を fallback として使用
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // 4. "unknown" の場合も制限を適用（共有バケット）
  return "unknown";
}

export function middleware(request: NextRequest) {
  // API ルートのみ対象
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const now = Date.now();

  // 100リクエストごとに遅延クリーンアップ
  requestCount++;
  if (requestCount >= CLEANUP_INTERVAL) {
    lazyCleanup();
    requestCount = 0;
  }

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
