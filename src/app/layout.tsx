import type { Metadata, Viewport } from "next";
import { DM_Sans, Noto_Sans_JP, Cormorant_Garamond } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";
import { ThemeProvider } from "@/components/ThemeProvider";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI意思決定アシスタント",
  description: "冷静ロジカル型 意思決定AIアシスタント",
  openGraph: {
    title: "AI意思決定アシスタント",
    description: "冷静ロジカル型 意思決定AIアシスタント",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AI意思決定アシスタント",
    description: "冷静ロジカル型 意思決定AIアシスタント",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkEnabled = clerkKey && clerkKey.startsWith("pk_");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f7f5f2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="color-scheme" content="light" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${dmSans.variable} ${notoSansJP.variable} ${cormorantGaramond.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );

  if (isClerkEnabled) {
    return <ClerkProvider>{body}</ClerkProvider>;
  }

  return body;
}
