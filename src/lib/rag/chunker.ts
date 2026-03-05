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

function extractOverlap(lastContent: string, overlapTokens: number): string {
  const words = lastContent.split(/\s+/);
  const overlapWords: string[] = [];
  let count = 0;
  for (let i = words.length - 1; i >= 0; i--) {
    count += estimateTokens(words[i]);
    if (count > overlapTokens) break;
    overlapWords.unshift(words[i]);
  }
  return overlapWords.join(" ");
}

function hardSplitByWords(
  text: string,
  chunkSizeTokens: number,
  startIndex: number
): { newChunks: Chunk[]; currentChunk: string; index: number } {
  const words = text.split(/\s+/);
  const newChunks: Chunk[] = [];
  let currentChunk = "";
  let index = startIndex;
  for (const word of words) {
    if (estimateTokens(currentChunk + " " + word) <= chunkSizeTokens) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      if (currentChunk.trim()) {
        newChunks.push({ content: currentChunk.trim(), index: index++ });
      }
      currentChunk = word;
    }
  }
  return { newChunks, currentChunk, index };
}

function splitOversizedSection(
  section: string,
  chunkSizeTokens: number,
  startIndex: number
): { newChunks: Chunk[]; currentChunk: string; index: number } {
  const paragraphs = section.split(/\n\n+/);
  const newChunks: Chunk[] = [];
  let currentChunk = "";
  let index = startIndex;

  for (const para of paragraphs) {
    if (estimateTokens(currentChunk + para) <= chunkSizeTokens) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk.trim()) {
        newChunks.push({ content: currentChunk.trim(), index: index++ });
      }
      if (estimateTokens(para) > chunkSizeTokens) {
        const split = hardSplitByWords(para, chunkSizeTokens, index);
        newChunks.push(...split.newChunks);
        currentChunk = split.currentChunk;
        index = split.index;
      } else {
        currentChunk = para;
      }
    }
  }
  return { newChunks, currentChunk, index };
}

export function chunkMarkdown(
  content: string,
  chunkSizeTokens: number = ragConfig.chunk_size_tokens,
  overlapTokens: number = ragConfig.chunk_overlap_tokens
): Chunk[] {
  const sections = content.split(/(?=^#{1,3}\s)/m).filter((s) => s.trim());

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let index = 0;

  for (const section of sections) {
    if (estimateTokens(currentChunk + section) <= chunkSizeTokens) {
      currentChunk += section;
    } else {
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), index: index++ });
      }

      if (estimateTokens(section) > chunkSizeTokens) {
        const split = splitOversizedSection(section, chunkSizeTokens, index);
        chunks.push(...split.newChunks);
        currentChunk = split.currentChunk;
        index = split.index;
      } else {
        const overlap = chunks.length > 0
          ? extractOverlap(chunks[chunks.length - 1].content, overlapTokens)
          : "";
        currentChunk = overlap ? overlap + "\n\n" + section : section;
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

      if (chunks.length > 0) {
        const overlap = extractOverlap(chunks[chunks.length - 1].content, overlapTokens);
        currentChunk = overlap ? overlap + "\n\n" + para : para;
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
