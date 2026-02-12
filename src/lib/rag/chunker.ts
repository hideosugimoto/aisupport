import ragConfig from "../../../config/rag.json";

export interface Chunk {
  content: string;
  index: number;
}

// Rough token estimation: ~4 chars per token for English, ~2 for Japanese
function estimateTokens(text: string): number {
  const asciiChars = text.replace(/[^\x00-\x7F]/g, "").length;
  const nonAsciiChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4 + nonAsciiChars / 2);
}

export function chunkMarkdown(
  content: string,
  chunkSizeTokens: number = ragConfig.chunk_size_tokens,
  overlapTokens: number = ragConfig.chunk_overlap_tokens
): Chunk[] {
  // Split by headings (## or ###) while keeping heading with its content
  const sections = content.split(/(?=^#{1,3}\s)/m).filter((s) => s.trim());

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let index = 0;

  for (const section of sections) {
    const combinedTokens = estimateTokens(currentChunk + section);

    if (combinedTokens <= chunkSizeTokens) {
      currentChunk += section;
    } else {
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), index: index++ });
      }

      // If a single section exceeds chunk size, split by paragraphs
      if (estimateTokens(section) > chunkSizeTokens) {
        const paragraphs = section.split(/\n\n+/);
        currentChunk = "";

        for (const para of paragraphs) {
          if (estimateTokens(currentChunk + para) <= chunkSizeTokens) {
            currentChunk += (currentChunk ? "\n\n" : "") + para;
          } else {
            if (currentChunk.trim()) {
              chunks.push({ content: currentChunk.trim(), index: index++ });
            }
            // Hard split for very long paragraphs
            if (estimateTokens(para) > chunkSizeTokens) {
              const words = para.split(/\s+/);
              currentChunk = "";
              for (const word of words) {
                if (estimateTokens(currentChunk + " " + word) <= chunkSizeTokens) {
                  currentChunk += (currentChunk ? " " : "") + word;
                } else {
                  if (currentChunk.trim()) {
                    chunks.push({ content: currentChunk.trim(), index: index++ });
                  }
                  currentChunk = word;
                }
              }
            } else {
              currentChunk = para;
            }
          }
        }
      } else {
        // Add overlap from previous chunk
        if (chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1].content;
          const lastWords = lastChunk.split(/\s+/);
          const overlapWords: string[] = [];
          let overlapCount = 0;
          for (let i = lastWords.length - 1; i >= 0; i--) {
            overlapCount += estimateTokens(lastWords[i]);
            if (overlapCount > overlapTokens) break;
            overlapWords.unshift(lastWords[i]);
          }
          currentChunk = overlapWords.join(" ") + "\n\n" + section;
        } else {
          currentChunk = section;
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: index++ });
  }

  return chunks;
}

export function chunkPlainText(
  content: string,
  chunkSizeTokens: number = ragConfig.chunk_size_tokens,
  overlapTokens: number = ragConfig.chunk_overlap_tokens
): Chunk[] {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let index = 0;

  for (const para of paragraphs) {
    if (estimateTokens(currentChunk + "\n\n" + para) <= chunkSizeTokens) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), index: index++ });
      }

      // Overlap
      if (chunks.length > 0) {
        const lastWords = chunks[chunks.length - 1].content.split(/\s+/);
        const overlapWords: string[] = [];
        let count = 0;
        for (let i = lastWords.length - 1; i >= 0; i--) {
          count += estimateTokens(lastWords[i]);
          if (count > overlapTokens) break;
          overlapWords.unshift(lastWords[i]);
        }
        currentChunk = overlapWords.join(" ") + "\n\n" + para;
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: index++ });
  }

  return chunks;
}

export function chunkDocument(
  content: string,
  mimeType: string
): Chunk[] {
  if (mimeType === "text/markdown" || mimeType === "text/x-markdown") {
    return chunkMarkdown(content);
  }
  return chunkPlainText(content);
}
