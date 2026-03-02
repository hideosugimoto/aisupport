import { describe, it, expect } from "vitest";
import { normalizeArticleUrl } from "@/lib/feed/url-utils";

describe("normalizeArticleUrl", () => {
  it("http を https に統一する", () => {
    expect(normalizeArticleUrl("http://example.com/article")).toBe(
      "https://example.com/article"
    );
  });

  it("ホスト名を小文字化する", () => {
    expect(normalizeArticleUrl("https://EXAMPLE.COM/article")).toBe(
      "https://example.com/article"
    );
  });

  it("utm_* パラメータを除去する", () => {
    const url =
      "https://example.com/article?utm_source=google&utm_medium=cpc&utm_campaign=spring";
    expect(normalizeArticleUrl(url)).toBe("https://example.com/article");
  });

  it("カスタム utm_ パラメータも除去する", () => {
    const url = "https://example.com/article?utm_custom_tag=foo";
    expect(normalizeArticleUrl(url)).toBe("https://example.com/article");
  });

  it("fbclid, gclid を除去する", () => {
    const url =
      "https://example.com/article?fbclid=abc123&gclid=def456";
    expect(normalizeArticleUrl(url)).toBe("https://example.com/article");
  });

  it("mc_cid, mc_eid, ref, source を除去する", () => {
    const url =
      "https://example.com/article?mc_cid=a&mc_eid=b&ref=twitter&source=feed";
    expect(normalizeArticleUrl(url)).toBe("https://example.com/article");
  });

  it("非トラッキングパラメータは保持する", () => {
    const url = "https://example.com/article?id=123&page=2";
    expect(normalizeArticleUrl(url)).toBe(
      "https://example.com/article?id=123&page=2"
    );
  });

  it("トラッキングと非トラッキングが混在する場合、トラッキングのみ除去", () => {
    const url =
      "https://example.com/article?id=123&utm_source=google&page=2";
    expect(normalizeArticleUrl(url)).toBe(
      "https://example.com/article?id=123&page=2"
    );
  });

  it("フラグメントを除去する", () => {
    expect(
      normalizeArticleUrl("https://example.com/article#section")
    ).toBe("https://example.com/article");
  });

  it("末尾スラッシュを除去する", () => {
    expect(normalizeArticleUrl("https://example.com/article/")).toBe(
      "https://example.com/article"
    );
  });

  it("ルートパスのスラッシュは維持する", () => {
    expect(normalizeArticleUrl("https://example.com/")).toBe(
      "https://example.com/"
    );
  });

  it("全ルールを複合適用する", () => {
    const url =
      "http://EXAMPLE.COM/article/?utm_source=google&id=1&fbclid=abc#top";
    expect(normalizeArticleUrl(url)).toBe(
      "https://example.com/article?id=1"
    );
  });

  it("不正なURLはそのまま返す", () => {
    expect(normalizeArticleUrl("not-a-url")).toBe("not-a-url");
  });

  it("既に正規化済みのURLはそのまま返す", () => {
    const url = "https://example.com/article";
    expect(normalizeArticleUrl(url)).toBe(url);
  });
});
