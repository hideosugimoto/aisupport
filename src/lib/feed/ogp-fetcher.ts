import type { Logger } from "../logger/types";
import { isPublicUrl } from "./url-utils";

const OGP_TIMEOUT_MS = 3000;
const OGP_CONCURRENCY = 5;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

export class OgpFetcher {
  constructor(private readonly logger: Logger) {}

  async fetchImageUrl(articleUrl: string): Promise<string | undefined> {
    // S-1: プライベートIP/localhostへのアクセスをブロック
    if (!isPublicUrl(articleUrl)) return undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OGP_TIMEOUT_MS);

    try {
      let response = await fetch(articleUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
        redirect: "manual",
      });

      // リダイレクト先の安全性を検証してから追従
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || !isPublicUrl(new URL(location, articleUrl).href)) {
          return undefined;
        }
        response = await fetch(new URL(location, articleUrl).href, {
          signal: controller.signal,
          headers: { "User-Agent": "AiSupport-Feed/1.0" },
          redirect: "manual",
        });
      }

      if (!response.ok) return undefined;

      // HTMLの先頭部分だけ読む（<head>内にOGPがある）
      const html = await response.text();
      const head = html.slice(0, 10000);

      const match = OG_IMAGE_RE.exec(head) ?? OG_IMAGE_RE_ALT.exec(head);
      if (!match?.[1]) return undefined;

      const imageUrl = match[1];

      // 基本的なURLバリデーション
      if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
        return undefined;
      }

      return imageUrl;
    } catch {
      // タイムアウトや接続エラーは silent fail
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchImageUrls(
    articles: { url: string }[]
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    // 同時リクエスト数を制限して並列取得
    for (let i = 0; i < articles.length; i += OGP_CONCURRENCY) {
      const batch = articles.slice(i, i + OGP_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (article) => {
          const imageUrl = await this.fetchImageUrl(article.url);
          return { url: article.url, imageUrl };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.imageUrl) {
          map.set(result.value.url, result.value.imageUrl);
        }
      }
    }

    this.logger.info("OGP fetch completed", {
      total: articles.length,
      found: map.size,
    });

    return map;
  }
}
