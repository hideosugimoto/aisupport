import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    // 環境別 CSP 設定
    // - 開発環境: HMR のため unsafe-eval を許可
    // - 本番環境: unsafe-eval を完全削除、セキュリティを強化
    const isDevelopment = process.env.NODE_ENV !== "production";

    const csp = [
      "default-src 'self'",
      // script-src: 本番では 'self' のみ、開発では HMR 用に unsafe-eval 許可
      isDevelopment
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self'",
      // style-src: Next.js がインラインスタイルを使用するため unsafe-inline は残す
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      // 追加のセキュリティディレクティブ
      "frame-ancestors 'none'", // iframe 埋め込みを禁止（X-Frame-Options と同等）
      "base-uri 'self'", // base タグの悪用防止
      "form-action 'self'", // フォーム送信先を同一オリジンに制限
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
