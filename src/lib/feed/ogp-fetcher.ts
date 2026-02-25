import type { Logger } from "../logger/types";

const OGP_TIMEOUT_MS = 3000;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

export class OgpFetcher {
  constructor(private readonly logger: Logger) {}

  async fetchImageUrl(articleUrl: string): Promise<string | undefined> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OGP_TIMEOUT_MS);

      const response = await fetch(articleUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "AiSupport-Feed/1.0" },
        redirect: "follow",
      });
      clearTimeout(timeout);

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
    }
  }

  async fetchImageUrls(
    articles: { url: string }[]
  ): Promise<Map<string, string>> {
    const results = await Promise.allSettled(
      articles.map(async (article) => {
        const imageUrl = await this.fetchImageUrl(article.url);
        return { url: article.url, imageUrl };
      })
    );

    const map = new Map<string, string>();
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.imageUrl) {
        map.set(result.value.url, result.value.imageUrl);
      }
    }

    this.logger.info("OGP fetch completed", {
      total: articles.length,
      found: map.size,
    });

    return map;
  }
}
