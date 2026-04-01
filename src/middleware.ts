import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;

// ログイン試行制限
const LOGIN_WINDOW_MS = 30 * 60 * 1000; // 30分
const MAX_LOGIN_ATTEMPTS = 10;
const CLEANUP_INTERVAL = 100;
const MAX_MAP_SIZE = 10000;

// NOTE: インメモリMapはサーバーレスインスタンス間で共有されないため best-effort。
// TODO(infra): Redis/Upstash 等の外部ストアへの移行を検討（スケール時に対応）。
const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
const loginAttemptMap = new Map<string, { count: number; resetTime: number }>();
let requestCount = 0;

function lazyCleanup() {
  const now = Date.now();
  if (ipRequestMap.size > MAX_MAP_SIZE) {
    // 期限切れエントリを優先削除（全クリアを避ける）
    for (const [ip, data] of ipRequestMap) {
      if (now > data.resetTime) {
        ipRequestMap.delete(ip);
      }
    }
    // それでも超過なら古い半分を削除
    if (ipRequestMap.size > MAX_MAP_SIZE) {
      const entries = Array.from(ipRequestMap.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      for (const [ip] of toDelete) {
        ipRequestMap.delete(ip);
      }
    }
    requestCount = 0;
    return;
  }
  for (const [ip, data] of ipRequestMap) {
    if (now > data.resetTime) {
      ipRequestMap.delete(ip);
    }
  }
}

function getClientIP(request: NextRequest): string {
  // Vercelが設定する信頼できるヘッダーを最優先
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  // CloudFlare経由の場合
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // X-Forwarded-Forは最初のIP（クライアントIP）を使用
  // 注: Vercel/CloudFlareが信頼できるヘッダーを設定するため、ここに到達するのは稀
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "unknown";
}

function loginRateLimit(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/sign-in") && !path.startsWith("/sign-up")) return null;
  if (request.method !== "POST") return null;

  const ip = getClientIP(request);
  const now = Date.now();
  const existing = loginAttemptMap.get(ip);

  if (!existing || now > existing.resetTime) {
    loginAttemptMap.set(ip, { count: 1, resetTime: now + LOGIN_WINDOW_MS });
    return null;
  }

  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    return NextResponse.json(
      { error: "ログイン試行回数の上限に達しました。30分後に再試行してください。" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((existing.resetTime - now) / 1000)) } }
    );
  }

  existing.count++;
  return null;
}

function rateLimit(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;
  // Stripe Webhookはレートリミット対象外（Stripe側が送信制御）
  if (request.nextUrl.pathname === "/api/stripe/webhook") return null;
  if (process.env.E2E_MOCK === "true" && process.env.NODE_ENV !== "production") return null;

  const ip = getClientIP(request);
  const now = Date.now();

  requestCount++;
  if (requestCount >= CLEANUP_INTERVAL) {
    lazyCleanup();
    requestCount = 0;
  }

  const existing = ipRequestMap.get(ip);

  if (!existing || now > existing.resetTime) {
    ipRequestMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return null;
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
  return null;
}

// 公開ルート（認証不要）
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms",
  "/privacy",
  "/share/(.*)",
  "/api/stripe/webhook",
  "/api/feed/cron",
  "/api/feed/digest-cron",
]);

// 管理者専用ルート
const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // ログイン試行制限
  const loginLimitResponse = loginRateLimit(request);
  if (loginLimitResponse) return loginLimitResponse;

  // APIレートリミット
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // 認証済みユーザーがランディングページにアクセスした場合、ダッシュボードへ転送
  const { userId } = await auth();
  if (userId && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 公開ルート以外は認証を要求
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // 管理者ルートは publicMetadata.role === "admin" を要求
  if (isAdminRoute(request)) {
    const metadata = (await auth()).sessionClaims?.publicMetadata as Record<string, unknown> | undefined;
    if (metadata?.role !== "admin") {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
