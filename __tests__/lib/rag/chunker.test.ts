import { describe, it, expect } from "vitest";
import { chunkMarkdown, chunkPlainText, chunkDocument } from "@/lib/rag/chunker";

describe("Chunker", () => {
  describe("chunkMarkdown", () => {
    it("should split markdown by headings", () => {
      const content = `# Title

Introduction paragraph.

## Section 1

Content of section 1.

## Section 2

Content of section 2.`;

      const chunks = chunkMarkdown(content, 500, 50);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].content).toContain("Title");
      expect(chunks[0].index).toBe(0);
    });

    it("should keep small documents as single chunk", () => {
      const content = "# Small\n\nJust a small document.";
      const chunks = chunkMarkdown(content, 500, 50);
      expect(chunks.length).toBe(1);
    });

    it("should split large sections into multiple chunks", () => {
      // Create content large enough to require splitting
      const longParagraph = "This is a test sentence. ".repeat(200);
      const content = `# Title\n\n${longParagraph}`;

      const chunks = chunkMarkdown(content, 100, 20);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("should return empty array for empty content", () => {
      const chunks = chunkMarkdown("", 500, 50);
      expect(chunks).toEqual([]);
    });
  });

  describe("chunkPlainText", () => {
    it("should split text by paragraphs", () => {
      const content = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.";
      const chunks = chunkPlainText(content, 500, 50);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].content).toContain("Paragraph 1");
    });

    it("should handle single paragraph", () => {
      const chunks = chunkPlainText("Just one paragraph.", 500, 50);
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe("Just one paragraph.");
    });
  });

  describe("chunkDocument", () => {
    it("should use markdown chunker for md mime type", () => {
      const content = "# Title\n\nContent.";
      const chunks = chunkDocument(content, "text/markdown");
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should use plain text chunker for other types", () => {
      const content = "Some plain text content.";
      const chunks = chunkDocument(content, "text/plain");
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
