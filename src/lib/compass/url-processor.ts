import { parse as parseHTML } from "node-html-parser";
import type { LLMClient } from "../llm/types";
import { loadTemplate } from "../llm/prompt-builder";
import compassConfig from "../../../config/compass.json";

export interface ProcessedUrl {
  title: string;
  summary: string;
  fullText: string;
}

/**
 * SSRF対策: 内部/プライベートURLをブロック
 */
function validateUrlForSsrf(url: string): void {
  const parsed = new URL(url);

  // プロトコルチェック（HTTP/HTTPS以外を拒否）
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("許可されていないプロトコルです（HTTP/HTTPSのみ利用可能）");
  }

  const hostname = parsed.hostname.toLowerCase();

  // localhostバリアントをブロック
  const localhostPatterns = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
  ];
  if (localhostPatterns.some((pattern) => hostname === pattern)) {
    throw new Error("内部ホストへのアクセスは許可されていません");
  }

  // AWSメタデータエンドポイントをブロック
  if (hostname === "169.254.169.254") {
    throw new Error("メタデータエンドポイントへのアクセスは許可されていません");
  }

  // プライベートIPレンジをブロック
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = hostname.match(ipv4Regex);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const isPrivate =
      octets[0] === 10 || // 10.x.x.x
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16-31.x.x
      (octets[0] === 192 && octets[1] === 168); // 192.168.x.x
    if (isPrivate) {
      throw new Error("プライベートIPアドレスへのアクセスは許可されていません");
    }
  }

  // IPv6プライベートレンジをブロック（fc00::/7, fe80::/10）
  if (hostname.includes(":")) {
    const lowerHost = hostname.toLowerCase();
    if (lowerHost.startsWith("fc") || lowerHost.startsWith("fd") || lowerHost.startsWith("fe8") || lowerHost.startsWith("fe9") || lowerHost.startsWith("fea") || lowerHost.startsWith("feb")) {
      throw new Error("プライベートIPv6アドレスへのアクセスは許可されていません");
    }
  }
}

export async function processUrl(
  url: string,
  client: LLMClient,
  model: string
): Promise<ProcessedUrl> {
  // SSRF対策: URLの安全性を検証
  validateUrlForSsrf(url);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    compassConfig.url_fetch_timeout_ms
  );

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AiSupport-Compass/1.0" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    html = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`URL取得がタイムアウトしました`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const root = parseHTML(html);

  // Remove script and style tags
  root.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

  const title =
    root.querySelector("title")?.textContent?.trim() ?? url;
  const fullText = root.textContent
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, compassConfig.max_url_content_length);

  // Generate summary via LLM
  const promptTemplate = loadTemplate("compass", "url-summarize.md");
  // Prompt Injection対策: ユーザー入力を明確に境界マーク
  const boundedContent = `---ユーザー入力開始---\n${fullText.slice(0, 3000)}\n---ユーザー入力終了---`;
  const promptContent = promptTemplate.replace("{{content}}", boundedContent);

  const response = await client.chat({
    model,
    messages: [{ role: "user", content: promptContent }],
    maxTokens: 500,
  });

  return {
    title,
    summary: response.content,
    fullText,
  };
}
