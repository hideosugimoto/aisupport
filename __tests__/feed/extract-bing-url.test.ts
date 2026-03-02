import { describe, it, expect } from "vitest";
import { extractBingUrl } from "@/lib/feed/news-fetcher";

describe("extractBingUrl", () => {
  it("should extract actual URL from &amp;-encoded Bing redirect URL", () => {
    const bingUrl =
      "http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=test&amp;url=https%3a%2f%2fjapan.cnet.com%2farticle%2f35244450%2f&amp;c=123&amp;mkt=ja-jp";
    expect(extractBingUrl(bingUrl)).toBe(
      "https://japan.cnet.com/article/35244450/"
    );
  });

  it("should extract actual URL from normal Bing redirect URL", () => {
    const bingUrl =
      "http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=test&url=https%3a%2f%2fjapan.cnet.com%2farticle%2f35244450%2f&c=123&mkt=ja-jp";
    expect(extractBingUrl(bingUrl)).toBe(
      "https://japan.cnet.com/article/35244450/"
    );
  });

  it("should fallback to normalized URL when no url/r param exists", () => {
    expect(extractBingUrl("https://www.example.com/article")).toBe(
      "https://www.example.com/article"
    );
  });

  it("should fallback for invalid URL input", () => {
    expect(extractBingUrl("not-a-url")).toBe("not-a-url");
  });

  it("should extract URL using r param as fallback", () => {
    const bingUrl =
      "http://www.bing.com/news/apiclick.aspx?ref=FexRss&r=https%3a%2f%2fexample.com%2fnews";
    expect(extractBingUrl(bingUrl)).toBe("https://example.com/news");
  });

  it("should reject private URLs and fallback to normalized wrapper", () => {
    const bingUrl =
      "http://www.bing.com/news/apiclick.aspx?url=http%3a%2f%2f127.0.0.1%2fmalicious";
    // isPublicUrl rejects 127.0.0.1 → falls back to normalized (the wrapper URL itself)
    expect(extractBingUrl(bingUrl)).toBe(
      "http://www.bing.com/news/apiclick.aspx?url=http%3a%2f%2f127.0.0.1%2fmalicious"
    );
  });
});
