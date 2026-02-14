import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 10;
const CLEANUP_INTERVAL = 100;
const MAX_MAP_SIZE = 10000;

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
let requestCount = 0;

function lazyCleanup() {
  const now = Date.now();
  if (ipRequestMap.size > MAX_MAP_SIZE) {
    ipRequestMap.clear();
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
  // Vercel/CloudFlare等のリバースプロキシでは最初のIPがクライアントIP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
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
  "/api/stripe/webhook",
]);

export default clerkMiddleware(async (auth, request) => {
  // レートリミット
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // 公開ルート以外は認証を要求
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
