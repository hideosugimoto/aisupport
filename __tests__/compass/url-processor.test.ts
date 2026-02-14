import { describe, it, expect, vi, beforeEach } from "vitest";
import { processUrl } from "@/lib/compass/url-processor";
import type { LLMClient } from "@/lib/llm/types";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockClient: LLMClient = {
  chat: vi.fn(),
  chatStream: vi.fn(),
  extractUsage: vi.fn(),
};

describe("url-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract title and generate summary", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          "<html><head><title>My Dream</title></head><body><p>Content about goals</p></body></html>"
        ),
    });

    vi.mocked(mockClient.chat).mockResolvedValue({
      content: "要約: 目標に関する記事",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await processUrl("https://example.com", mockClient, "gpt-4o-mini");

    expect(result.title).toBe("My Dream");
    expect(result.summary).toBe("要約: 目標に関する記事");
    expect(result.fullText).toContain("Content about goals");
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(processUrl("https://example.com/404", mockClient, "gpt-4o-mini")).rejects.toThrow(
      "HTTP 404"
    );
  });

  it("should use fallback title when none found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body>No title here</body></html>"),
    });

    vi.mocked(mockClient.chat).mockResolvedValue({
      content: "要約テスト",
      usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
    });

    const result = await processUrl("https://example.com/no-title", mockClient, "gpt-4o-mini");
    expect(result.title).toBe("https://example.com/no-title");
  });

  it("should handle fetch timeout", async () => {
    mockFetch.mockRejectedValue(new Error("The operation was aborted"));

    await expect(processUrl("https://example.com/slow", mockClient, "gpt-4o-mini")).rejects.toThrow(
      "The operation was aborted"
    );
  });

  it("should truncate long content", async () => {
    const longContent = "a".repeat(100000);
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<html><head><title>Long</title></head><body>${longContent}</body></html>`),
    });

    vi.mocked(mockClient.chat).mockResolvedValue({
      content: "要約: 長い記事",
      usage: { inputTokens: 200, outputTokens: 40, totalTokens: 240 },
    });

    const result = await processUrl("https://example.com/long", mockClient, "gpt-4o-mini");
    expect(result.fullText.length).toBeLessThanOrEqual(50000); // config: max_url_content_length
  });

  it("should remove script and style tags", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          "<html><head><title>Clean</title><script>alert('test')</script><style>body{}</style></head><body>Clean content</body></html>"
        ),
    });

    vi.mocked(mockClient.chat).mockResolvedValue({
      content: "要約: クリーンな記事",
      usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
    });

    const result = await processUrl("https://example.com/clean", mockClient, "gpt-4o-mini");
    expect(result.fullText).not.toContain("alert");
    expect(result.fullText).not.toContain("body{}");
    expect(result.fullText).toContain("Clean content");
  });
});
