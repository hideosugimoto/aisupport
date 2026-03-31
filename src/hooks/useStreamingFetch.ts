"use client";

import { useRef, useCallback } from "react";
import type { CompassRelevance } from "@/lib/compass/types";
import type { DecisionContextHints } from "@/lib/decision/task-decision-engine";

export interface StreamingMeta {
  compassRelevance?: CompassRelevance;
  contextHints?: DecisionContextHints;
  remaining?: number;
}

export interface StreamingChunk {
  content?: string;
  usage?: { inputTokens: number; outputTokens: number };
  error?: { error: string };
  meta?: StreamingMeta;
}

export interface StreamingCallbacks {
  onStart: () => void;
  onStreaming: () => void;
  onChunk: (chunk: StreamingChunk) => void;
  onComplete: (inputTokens: number, outputTokens: number, meta?: StreamingMeta) => void;
  onError: (message: string) => void;
}

export function useStreamingFetch() {
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const fetchStream = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      callbacks: StreamingCallbacks
    ) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      callbacks.onStart();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
          }
          callbacks.onError(
            errorData.errors?.join(", ") ??
              errorData.error ??
              "エラーが発生しました"
          );
          return;
        }

        callbacks.onStreaming();

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let lastInputTokens = 0;
        let lastOutputTokens = 0;
        let lastMeta: StreamingMeta | undefined;
        let lineBuffer = "";

        try {
          while (true) {
            if (signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const chunk: StreamingChunk = JSON.parse(data);
                if (chunk.error) {
                  const safeMessage =
                    typeof chunk.error?.error === "string" &&
                    chunk.error.error.length < 200
                      ? chunk.error.error
                      : "エラーが発生しました";
                  callbacks.onError(safeMessage);
                  return;
                }
                if (chunk.meta) {
                  lastMeta = chunk.meta;
                }
                callbacks.onChunk(chunk);
                if (chunk.usage) {
                  lastInputTokens = chunk.usage.inputTokens;
                  lastOutputTokens = chunk.usage.outputTokens;
                }
              } catch {
                // skip invalid JSON
              }
            }
          }
        } finally {
          reader.cancel();
        }

        if (!signal.aborted) {
          callbacks.onComplete(lastInputTokens, lastOutputTokens, lastMeta);
        }
      } catch (error) {
        if (signal.aborted) return;
        callbacks.onError(
          error instanceof Error ? error.message : "通信エラー"
        );
      }
    },
    []
  );

  return { fetchStream, abort };
}
