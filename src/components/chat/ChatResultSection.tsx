"use client";

import { ChatMessage } from "../ChatMessage";
import { DecisionResult } from "../DecisionResult";
import { BreakdownResult } from "../BreakdownResult";
import { CompassSuggestionCard } from "../CompassSuggestionCard";
import type { CompassSuggestion } from "@/lib/compass/compass-suggester";
import type { State } from "@/lib/reducers/decision-reducer";
import featuresConfig from "../../../config/features.json";

interface ChatResultSectionProps {
  apiState: State;
  energyLevel: number | null;
  provider: string;
  model: string;
  compassSuggestion: CompassSuggestion | null;
  compassSuggestionLoading: boolean;
  onBreakdown: (task: string) => void;
  onRetry: () => void;
  onAddCompassTask: (task: string) => void;
  onShare?: () => void;
  sharing?: boolean;
}

export function ChatResultSection({
  apiState,
  energyLevel,
  provider,
  model,
  compassSuggestion,
  compassSuggestionLoading,
  onBreakdown,
  onRetry,
  onAddCompassTask,
  onShare,
  sharing,
}: ChatResultSectionProps) {
  const isAnxietyMode =
    (energyLevel ?? 3) <= featuresConfig.anxiety_mode_threshold;

  return (
    <>
      {apiState.status === "error" && (
        <ChatMessage>
          <div role="alert" className="space-y-2">
            <p className="text-amber-brand">
              {apiState.error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="text-sm text-amber-brand underline hover:text-amber-brand"
            >
              リトライ
            </button>
          </div>
        </ChatMessage>
      )}

      {(apiState.status === "streaming" || apiState.status === "completed") &&
        apiState.content && (
          <>
            <ChatMessage>
              <p>分析しました。</p>
            </ChatMessage>
            <div className="ml-11" aria-live="polite">
              <DecisionResult
                content={apiState.content}
                isAnxietyMode={isAnxietyMode}
                provider={apiState.provider || provider}
                model={apiState.model || model}
                inputTokens={apiState.inputTokens}
                outputTokens={apiState.outputTokens}
                remaining={apiState.remaining}
                onBreakdown={
                  apiState.status === "completed" ? onBreakdown : undefined
                }
                onShare={apiState.status === "completed" ? onShare : undefined}
                sharing={sharing}
                compassRelevance={apiState.compassRelevance}
                contextHints={apiState.contextHints}
              />
            </div>
          </>
        )}

      {/* Breakdown loading */}
      {apiState.breakdownStatus === "loading" && (
        <div
          role="status"
          aria-busy="true"
          className="ml-11 text-sm text-text2"
        >
          タスクを分解中...
        </div>
      )}

      {/* Breakdown error */}
      {apiState.breakdownStatus === "error" && (
        <div
          role="alert"
          className="ml-11 rounded-lg border border-amber-bd bg-amber-bg p-4"
        >
          <p className="text-sm text-amber-brand">
            {apiState.breakdownError}
          </p>
        </div>
      )}

      {/* Breakdown result */}
      {(apiState.breakdownStatus === "streaming" ||
        apiState.breakdownStatus === "completed") &&
        apiState.breakdownContent && (
          <div className="ml-11">
            <BreakdownResult
              content={apiState.breakdownContent}
              isAnxietyMode={isAnxietyMode}
              provider={apiState.provider || provider}
              model={apiState.model || model}
              inputTokens={apiState.breakdownInputTokens}
              outputTokens={apiState.breakdownOutputTokens}
            />
          </div>
        )}

      {/* Compass suggestion card */}
      {apiState.status === "completed" && apiState.content && (
        <div className="ml-11" aria-live="polite">
          <CompassSuggestionCard
            suggestion={compassSuggestion}
            loading={compassSuggestionLoading}
            onAddTask={onAddCompassTask}
          />
        </div>
      )}
    </>
  );
}
