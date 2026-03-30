import type { Retriever } from "../rag/retriever";
import type { NeglectDetector } from "./neglect-detector";
import type { Logger } from "../logger/types";
import { nullLogger } from "../logger/null-logger";

/**
 * Compass Retriever を生成する。OPENAI_API_KEY が未設定の場合は undefined を返す。
 * Embedding は OpenAI API 固定のため、process.env.OPENAI_API_KEY が必須。
 */
export async function createCompassRetrieverIfAvailable(): Promise<Retriever | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;

  const { OpenAIEmbedder } = await import("../rag/embedder");
  const { PrismaCompassVectorStore } = await import("./compass-vector-store");
  const { CompassRetriever } = await import("./compass-retriever");

  const compassStore = new PrismaCompassVectorStore();
  const compassEmbedder = new OpenAIEmbedder();
  return new CompassRetriever(compassEmbedder, compassStore);
}

/**
 * Compass NeglectDetector を生成する。OPENAI_API_KEY が未設定の場合は undefined を返す。
 */
export async function createNeglectDetectorIfAvailable(
  logger: Logger = nullLogger
): Promise<NeglectDetector | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;

  const { OpenAIEmbedder } = await import("../rag/embedder");
  const { PrismaCompassVectorStore } = await import("./compass-vector-store");
  const { DefaultNeglectDetector } = await import("./neglect-detector");

  const compassStore = new PrismaCompassVectorStore();
  const compassEmbedder = new OpenAIEmbedder();
  return new DefaultNeglectDetector(compassEmbedder, compassStore, logger);
}
