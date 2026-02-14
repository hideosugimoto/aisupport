import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    // 環境別 CSP 設定
    // - 開発環境: HMR のため unsafe-eval を許可
    // - 本番環境: unsafe-eval を完全削除、セキュリティを強化
    const isDevelopment = process.env.NODE_ENV !== "production";

    // Note: Next.js/Clerk がインラインスクリプト・スタイルを使用するため
    // unsafe-inline は現時点で必要。将来 nonce 方式に移行予定。
    const csp = [
      "default-src 'self'",
      isDevelopment
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev"
        : "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://img.clerk.com",
      "font-src 'self'",
      "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com",
      "worker-src 'self'",
      "frame-src 'self' https://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
