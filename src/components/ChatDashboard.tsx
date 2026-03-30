"use client";

import { useReducer, useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { CompassSummary } from "./CompassSummary";
import { TaskChipInput } from "./TaskChipInput";
import { TimeSelector } from "./TimeSelector";
import { EnergySelector } from "./EnergySelector";
import { CompassSetupStep } from "./chat/CompassSetupStep";
import { ChatConfirmStep } from "./chat/ChatConfirmStep";
import { ChatResultSection } from "./chat/ChatResultSection";
import { SessionContinueModal } from "./chat/SessionContinueModal";
import type { CompassSuggestion } from "@/lib/compass/compass-suggester";
import {
  reducer,
  initialState,
  type ChatStep,
} from "@/lib/reducers/decision-reducer";
import { useStreamingFetch } from "@/hooks/useStreamingFetch";
import { useBudgetCheck } from "@/hooks/useBudgetCheck";
import { useHistoryAutoSave } from "@/hooks/useHistoryAutoSave";
import { useCompassSetup } from "@/hooks/useCompassSetup";
import featuresConfig from "../../config/features.json";

export function ChatDashboard() {
  const [apiState, dispatch] = useReducer(reducer, initialState);

  // Hooks
  const {
    compassItems,
    setCompassItems,
    compassInput,
    setCompassInput,
    compassDrafts,
    compassSaving,
    hasCompass,
    isCompassLoading,
    addDraft,
    removeDraft,
    saveDrafts,
    skip: skipCompassSetup,
  } = useCompassSetup();

  const { budgetWarning, checkBudget, clearWarning } = useBudgetCheck();
  const { fetchStream: fetchDecision, abort: abortDecision } = useStreamingFetch();
  const { fetchStream: fetchBreakdown, abort: abortBreakdown } = useStreamingFetch();

  // Chat step state
  const [tasks, setTasks] = useState<string[]>([]);
  const [availableTime, setAvailableTime] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);

  // Advanced settings
  const [provider, setProvider] = useState(featuresConfig.default_provider);
  const [model, setModel] = useState(
    featuresConfig.default_model[
      featuresConfig.default_provider as keyof typeof featuresConfig.default_model
    ]
  );
  const [autoFallback, setAutoFallback] = useState(false);

  // Session continuation state
  const [isSelectingCompleted, setIsSelectingCompleted] = useState(false);
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());

  // Compass suggestion state
  const [compassSuggestion, setCompassSuggestion] = useState<CompassSuggestion | null>(null);
  const [compassSuggestionLoading, setCompassSuggestionLoading] = useState(false);

  // Refs for scroll-into-view
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Derive current step
  const currentStep: ChatStep = (() => {
    if (apiState.status === "loading" || apiState.status === "streaming") return "loading";
    if (apiState.status === "completed" || apiState.status === "error") return "result";
    if (energyLevel !== null) return "confirm";
    if (availableTime !== null) return "energy";
    if (tasks.length > 0) return "time";
    if (!hasCompass && !isCompassLoading) return "compass-setup";
    return "tasks";
  })();

  // Auto-save to history
  useHistoryAutoSave({
    status: apiState.status,
    content: apiState.content,
    provider: apiState.provider,
    model: apiState.model,
    inputTokens: apiState.inputTokens,
    outputTokens: apiState.outputTokens,
    tasks,
    energyLevel,
    availableTime,
  });

  // Restore from sessionStorage (history page -> dashboard)
  useEffect(() => {
    const raw = sessionStorage.getItem("dashboard-restore");
    if (raw) {
      sessionStorage.removeItem("dashboard-restore");
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          setTasks(data.tasks.filter((t: unknown) => typeof t === "string" && t.trim()));
        }
      } catch {
        // ignore invalid data
      }
    }
  }, []);

  // Scroll into view when steps change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep === "time") timeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (currentStep === "energy") energyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (currentStep === "confirm") confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (currentStep === "result") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Provider change handler
  const handleProviderChange = useCallback((p: string) => {
    setProvider(p);
    setModel(featuresConfig.default_model[p as keyof typeof featuresConfig.default_model]);
  }, []);

  // Submit handler
  const handleSubmit = async () => {
    const canProceed = await checkBudget();
    if (!canProceed) return;

    setCompassSuggestion(null);
    setCompassSuggestionLoading(true);

    // Compass suggestion (fire-and-forget)
    fetch("/api/compass/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: tasks.filter((t) => t.trim().length > 0),
        timeMinutes: availableTime ?? 60,
        energyLevel: energyLevel ?? 3,
        provider,
        model,
      }),
    })
      .then((res) => res.json())
      .then((data) => setCompassSuggestion(data.suggestion ?? null))
      .catch(() => setCompassSuggestion(null))
      .finally(() => setCompassSuggestionLoading(false));

    await fetchDecision(
      "/api/decide",
      {
        tasks: tasks.filter((t) => t.trim().length > 0),
        availableTime: availableTime ?? 60,
        energyLevel: energyLevel ?? 3,
        provider,
        model,
        stream: true,
        fallback: autoFallback,
      },
      {
        onStart: () => dispatch({ type: "START_LOADING" }),
        onStreaming: () => dispatch({ type: "START_STREAMING" }),
        onChunk: (chunk) => {
          if (chunk.content) {
            dispatch({ type: "APPEND_CONTENT", content: chunk.content });
          }
        },
        onComplete: (inputTokens, outputTokens, meta) => {
          dispatch({
            type: "COMPLETE",
            provider,
            model,
            inputTokens,
            outputTokens,
            isAnxietyMode: (energyLevel ?? 3) <= featuresConfig.anxiety_mode_threshold,
          });
          if (meta?.compassRelevance) {
            dispatch({ type: "SET_COMPASS", compassRelevance: meta.compassRelevance });
          }
          if (meta?.contextHints) {
            dispatch({ type: "SET_CONTEXT_HINTS", contextHints: meta.contextHints });
          }
        },
        onError: (error) => dispatch({ type: "ERROR", error }),
      }
    );
  };

  // Fetch compass relevance after decision completes
  useEffect(() => {
    if (apiState.status === "completed" && apiState.content && !apiState.compassRelevance) {
      const fetchCompass = async () => {
        try {
          const res = await fetch("/api/compass");
          if (res.ok) {
            const data = await res.json();
            dispatch({
              type: "SET_COMPASS",
              compassRelevance: { hasCompass: data.items.length > 0, topMatches: [] },
            });
          }
        } catch (err) {
          console.warn("[Compass] 取得失敗:", err instanceof Error ? err.message : String(err));
        }
      };
      fetchCompass();
    }
  }, [apiState.status, apiState.content, apiState.compassRelevance]);

  // Breakdown handler
  const handleBreakdown = async (task: string) => {
    await fetchBreakdown(
      "/api/breakdown",
      {
        task,
        availableTime: availableTime ?? 60,
        energyLevel: energyLevel ?? 3,
        provider,
        model,
        stream: true,
        fallback: autoFallback,
      },
      {
        onStart: () => dispatch({ type: "START_BREAKDOWN" }),
        onStreaming: () => dispatch({ type: "START_BREAKDOWN_STREAMING" }),
        onChunk: (chunk) => {
          if (chunk.content) {
            dispatch({ type: "APPEND_BREAKDOWN_CONTENT", content: chunk.content });
          }
        },
        onComplete: (inputTokens, outputTokens) => {
          dispatch({ type: "COMPLETE_BREAKDOWN", inputTokens, outputTokens });
        },
        onError: (error) => dispatch({ type: "BREAKDOWN_ERROR", error }),
      }
    );
  };

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      abortDecision();
      abortBreakdown();
    };
  }, [abortDecision, abortBreakdown]);

  // Reset for new session
  const handleReset = () => {
    abortDecision();
    abortBreakdown();
    dispatch({ type: "RESET" });
    setTasks([]);
    setAvailableTime(null);
    setEnergyLevel(null);
    clearWarning();
    setCompassSuggestion(null);
    setCompassSuggestionLoading(false);
  };

  // Continue session
  const handleStartContinue = () => {
    setIsSelectingCompleted(true);
    setCompletedIndices(new Set());
  };

  const toggleCompletedIndex = (index: number) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleProceedAfterComplete = () => {
    const remaining = tasks.filter((_, i) => !completedIndices.has(i));
    abortDecision();
    abortBreakdown();
    dispatch({ type: "RESET" });
    setTasks(remaining);
    setAvailableTime(null);
    setEnergyLevel(null);
    clearWarning();
    setIsSelectingCompleted(false);
    setCompletedIndices(new Set());
    setCompassSuggestion(null);
    setCompassSuggestionLoading(false);
  };

  // Compass suggestion auto-resubmit
  const pendingResubmitRef = useRef(false);
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  const handleAddCompassTask = (suggestedTask: string) => {
    setTasks((prev) => [...prev, suggestedTask]);
    setCompassSuggestion(null);
    setCompassSuggestionLoading(false);
    dispatch({ type: "RESET" });
    pendingResubmitRef.current = true;
  };

  useEffect(() => {
    if (pendingResubmitRef.current && apiState.status === "idle" && tasks.length > 0) {
      pendingResubmitRef.current = false;
      handleSubmitRef.current();
    }
  }, [tasks, apiState.status]);

  const isSubmitting = apiState.status === "loading" || apiState.status === "streaming";

  // --- Render ---

  if (isCompassLoading) {
    return (
      <div className="space-y-6">
        <ChatMessage animate={false}>
          <p className="text-zinc-400">読み込み中...</p>
        </ChatMessage>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget warning */}
      {budgetWarning && (
        <div role="alert" aria-live="assertive" className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            {budgetWarning}
          </p>
        </div>
      )}

      {/* COMPASS SETUP */}
      {!hasCompass && currentStep === "compass-setup" && (
        <CompassSetupStep
          compassInput={compassInput}
          compassDrafts={compassDrafts}
          compassSaving={compassSaving}
          onInputChange={setCompassInput}
          onAddDraft={addDraft}
          onRemoveDraft={removeDraft}
          onSave={saveDrafts}
          onSkip={skipCompassSetup}
        />
      )}

      {/* TASK INPUT STEP */}
      {(hasCompass || currentStep !== "compass-setup") &&
        currentStep !== "loading" &&
        apiState.status !== "completed" &&
        apiState.status !== "error" && (
          <div className="space-y-4">
            <ChatMessage>
              <div className="space-y-2">
                {hasCompass && compassItems ? (
                  <>
                    <p>こんにちは。</p>
                    <CompassSummary items={compassItems} className="my-2" />
                    <p>
                      今日取り組みたいタスクを教えてください。
                      目標に沿った優先順位を提案します。
                    </p>
                  </>
                ) : (
                  <p>
                    今日取り組みたいタスクを教えてください。
                    あなたの目標に沿った優先順位を提案します。
                  </p>
                )}
              </div>
            </ChatMessage>
            <div className="ml-11">
              <TaskChipInput tasks={tasks} onTasksChange={setTasks} />
            </div>
          </div>
        )}

      {/* TIME STEP */}
      {tasks.length > 0 &&
        currentStep !== "loading" &&
        apiState.status !== "completed" &&
        apiState.status !== "error" && (
          <div ref={timeRef} className="space-y-4">
            <ChatMessage>
              <p>
                ありがとうございます。{tasks.length}つのタスクですね。
                今日はどのくらい時間が取れそうですか？
              </p>
            </ChatMessage>
            <div className="ml-11">
              <TimeSelector value={availableTime} onSelect={setAvailableTime} />
            </div>
          </div>
        )}

      {/* ENERGY STEP */}
      {availableTime !== null &&
        currentStep !== "loading" &&
        apiState.status !== "completed" &&
        apiState.status !== "error" && (
          <div ref={energyRef} className="space-y-4">
            <ChatMessage>
              <div className="space-y-1">
                <p>今の気力・体力はどのくらいですか？</p>
                <p className="text-xs text-zinc-400">
                  低いときは無理のないタスクを提案します。
                </p>
              </div>
            </ChatMessage>
            <div className="ml-11">
              <EnergySelector value={energyLevel} onSelect={setEnergyLevel} />
            </div>
          </div>
        )}

      {/* CONFIRM STEP */}
      {energyLevel !== null && currentStep === "confirm" && (
        <div ref={confirmRef}>
          <ChatConfirmStep
            tasks={tasks}
            availableTime={availableTime ?? 60}
            energyLevel={energyLevel}
            provider={provider}
            model={model}
            autoFallback={autoFallback}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onProviderChange={handleProviderChange}
            onModelChange={setModel}
            onFallbackChange={setAutoFallback}
          />
        </div>
      )}

      {/* LOADING STEP */}
      {currentStep === "loading" && (
        <div className="space-y-4" role="status" aria-live="polite">
          <ChatMessage>
            <p className="text-zinc-500 dark:text-zinc-400">分析しています...</p>
          </ChatMessage>
        </div>
      )}

      {/* RESULT STEP */}
      {(apiState.status === "completed" ||
        apiState.status === "streaming" ||
        apiState.status === "error") && (
        <div ref={resultRef} className="space-y-4">
          <ChatResultSection
            apiState={apiState}
            energyLevel={energyLevel}
            provider={provider}
            model={model}
            compassSuggestion={compassSuggestion}
            compassSuggestionLoading={compassSuggestionLoading}
            onBreakdown={handleBreakdown}
            onRetry={() => dispatch({ type: "RESET" })}
            onAddCompassTask={handleAddCompassTask}
          />

          {/* Session actions */}
          {apiState.status === "completed" && !isSelectingCompleted && (
            <div className="ml-11 flex flex-wrap gap-3 pt-4">
              <button
                type="button"
                onClick={handleStartContinue}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                完了して次へ
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                新しいタスク判定を始める
              </button>
            </div>
          )}

          {/* Task completion selection */}
          {apiState.status === "completed" && isSelectingCompleted && (
            <SessionContinueModal
              tasks={tasks}
              completedIndices={completedIndices}
              onToggle={toggleCompletedIndex}
              onProceed={handleProceedAfterComplete}
              onCancel={() => setIsSelectingCompleted(false)}
            />
          )}
        </div>
      )}

      <div ref={stepsEndRef} />
    </div>
  );
}
