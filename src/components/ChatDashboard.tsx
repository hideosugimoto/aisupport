"use client";

import { useReducer, useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { CompassSummary } from "./CompassSummary";
import { TaskChipInput } from "./TaskChipInput";
import { TimeSelector } from "./TimeSelector";
import { EnergySelector } from "./EnergySelector";
import { AdvancedSettings } from "./AdvancedSettings";
import { DecisionResult } from "./DecisionResult";
import { BreakdownResult } from "./BreakdownResult";
import featuresConfig from "../../config/features.json";
import { calculateCostUsd } from "@/lib/cost/pricing";

// --- Types ---

type ChatStep =
  | "compass-setup"
  | "tasks"
  | "time"
  | "energy"
  | "confirm"
  | "loading"
  | "result";

interface CompassItem {
  id: number;
  title: string;
}

interface CompassRelevance {
  hasCompass: boolean;
  topMatches: { title: string; similarity: number }[];
}

// --- Reducer (ported from TaskDecisionForm) ---

type UIState = "idle" | "loading" | "streaming" | "completed" | "error";

interface State {
  status: UIState;
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
  compassRelevance?: CompassRelevance;
  breakdownStatus: "idle" | "loading" | "streaming" | "completed" | "error";
  breakdownContent: string;
  breakdownInputTokens: number;
  breakdownOutputTokens: number;
  breakdownError: string | null;
}

type Action =
  | { type: "START_LOADING" }
  | { type: "START_STREAMING" }
  | { type: "APPEND_CONTENT"; content: string }
  | {
      type: "COMPLETE";
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      isAnxietyMode: boolean;
    }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "SET_COMPASS"; compassRelevance: CompassRelevance }
  | { type: "START_BREAKDOWN" }
  | { type: "START_BREAKDOWN_STREAMING" }
  | { type: "APPEND_BREAKDOWN_CONTENT"; content: string }
  | { type: "COMPLETE_BREAKDOWN"; inputTokens: number; outputTokens: number }
  | { type: "BREAKDOWN_ERROR"; error: string };

const initialState: State = {
  status: "idle",
  content: "",
  isAnxietyMode: false,
  provider: "",
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  error: null,
  breakdownStatus: "idle",
  breakdownContent: "",
  breakdownInputTokens: 0,
  breakdownOutputTokens: 0,
  breakdownError: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_LOADING":
      return { ...initialState, status: "loading" };
    case "START_STREAMING":
      return { ...state, status: "streaming" };
    case "APPEND_CONTENT":
      return { ...state, content: state.content + action.content };
    case "COMPLETE":
      return {
        ...state,
        status: "completed",
        content: state.content || "",
        provider: action.provider,
        model: action.model,
        inputTokens: action.inputTokens,
        outputTokens: action.outputTokens,
        isAnxietyMode: action.isAnxietyMode,
      };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return initialState;
    case "SET_COMPASS":
      return { ...state, compassRelevance: action.compassRelevance };
    case "START_BREAKDOWN":
      return {
        ...state,
        breakdownStatus: "loading",
        breakdownContent: "",
        breakdownInputTokens: 0,
        breakdownOutputTokens: 0,
        breakdownError: null,
      };
    case "START_BREAKDOWN_STREAMING":
      return { ...state, breakdownStatus: "streaming" };
    case "APPEND_BREAKDOWN_CONTENT":
      return {
        ...state,
        breakdownContent: state.breakdownContent + action.content,
      };
    case "COMPLETE_BREAKDOWN":
      return {
        ...state,
        breakdownStatus: "completed",
        breakdownInputTokens: action.inputTokens,
        breakdownOutputTokens: action.outputTokens,
      };
    case "BREAKDOWN_ERROR":
      return {
        ...state,
        breakdownStatus: "error",
        breakdownError: action.error,
      };
    default:
      return state;
  }
}

// --- Component ---

export function ChatDashboard() {
  // API state
  const [apiState, dispatch] = useReducer(reducer, initialState);

  // Chat step state
  const [compassItems, setCompassItems] = useState<CompassItem[] | null>(null); // null = loading
  const [tasks, setTasks] = useState<string[]>([]);
  const [availableTime, setAvailableTime] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);

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

  // Compass setup (initial user flow)
  const [compassInput, setCompassInput] = useState("");
  const [compassDrafts, setCompassDrafts] = useState<string[]>([]);
  const [compassSaving, setCompassSaving] = useState(false);

  // AbortController for streaming cleanup (C1 fix)
  const abortRef = useRef<AbortController | null>(null);

  // Refs for scroll-into-view
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Derive current step
  const hasCompass = compassItems !== null && compassItems.length > 0;
  const isCompassLoading = compassItems === null;

  const currentStep: ChatStep = (() => {
    if (apiState.status === "loading" || apiState.status === "streaming") return "loading";
    if (apiState.status === "completed" || apiState.status === "error") return "result";
    if (energyLevel !== null) return "confirm";
    if (availableTime !== null) return "energy";
    if (tasks.length > 0) return "time";
    if (!hasCompass && !isCompassLoading) return "compass-setup";
    return "tasks";
  })();

  // Restore from sessionStorage (history page → dashboard)
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

  // Fetch compass data on mount
  useEffect(() => {
    async function fetchCompass() {
      try {
        const res = await fetch("/api/compass");
        if (res.ok) {
          const data = await res.json();
          setCompassItems(data.items ?? []);
        } else {
          setCompassItems([]);
        }
      } catch {
        setCompassItems([]);
      }
    }
    fetchCompass();
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

  // Provider change handler — also reset model to default
  const handleProviderChange = useCallback(
    (p: string) => {
      setProvider(p);
      setModel(
        featuresConfig.default_model[p as keyof typeof featuresConfig.default_model]
      );
    },
    []
  );

  // --- Compass setup handlers ---

  const addCompassDraft = () => {
    const trimmed = compassInput.trim();
    if (!trimmed || compassDrafts.length >= 10) return;
    setCompassDrafts([...compassDrafts, trimmed]);
    setCompassInput("");
  };

  const removeCompassDraft = (index: number) => {
    setCompassDrafts(compassDrafts.filter((_, i) => i !== index));
  };

  const saveCompassItems = async () => {
    if (compassDrafts.length === 0) return;
    setCompassSaving(true);
    try {
      await Promise.all(
        compassDrafts.map((title) =>
          fetch("/api/compass", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "text", title, content: title }),
          })
        )
      );
      // Re-fetch compass items
      const res = await fetch("/api/compass");
      if (res.ok) {
        const data = await res.json();
        setCompassItems(data.items ?? []);
      }
      setCompassDrafts([]);
    } catch (err) {
      console.warn("[Compass] 登録失敗:", err instanceof Error ? err.message : String(err));
    } finally {
      setCompassSaving(false);
    }
  };

  const skipCompassSetup = () => {
    // Treat as "no compass" — go directly to task input
    setCompassItems([]);
  };

  // --- Submit handler (ported from TaskDecisionForm) ---

  const handleSubmit = async () => {
    // Budget check
    try {
      const costResponse = await fetch("/api/cost");
      if (costResponse.ok) {
        const costData = await costResponse.json();
        if (costData.budget) {
          if (costData.budget.alertLevel === "exceeded") {
            const confirmed = window.confirm(
              "月間予算を超過しています。それでも実行しますか？"
            );
            if (!confirmed) return;
          } else if (costData.budget.alertLevel === "warning") {
            setBudgetWarning("予算の80%を超えています。注意してください。");
          } else {
            setBudgetWarning(null);
          }
        }
      }
    } catch {
      // Budget check failure is non-critical
    }

    dispatch({ type: "START_LOADING" });

    // Cancel previous streaming request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.filter((t) => t.trim().length > 0),
          availableTime: availableTime ?? 60,
          energyLevel: energyLevel ?? 3,
          provider,
          model,
          stream: true,
          fallback: autoFallback,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        dispatch({
          type: "ERROR",
          error:
            errorData.errors?.join(", ") ??
            errorData.error ??
            "エラーが発生しました",
        });
        return;
      }

      dispatch({ type: "START_STREAMING" });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let lastInputTokens = 0;
      let lastOutputTokens = 0;

      try {
        while (true) {
          if (signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);
              if (chunk.error) {
                const safeMessage = typeof chunk.error?.error === "string" && chunk.error.error.length < 200
                  ? chunk.error.error
                  : "エラーが発生しました";
                dispatch({ type: "ERROR", error: safeMessage });
                return;
              }
              if (chunk.content) {
                dispatch({ type: "APPEND_CONTENT", content: chunk.content });
              }
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
        dispatch({
          type: "COMPLETE",
          provider,
          model,
          inputTokens: lastInputTokens,
          outputTokens: lastOutputTokens,
          isAnxietyMode:
            (energyLevel ?? 3) <= featuresConfig.anxiety_mode_threshold,
        });
      }
    } catch (error) {
      if (signal.aborted) return;
      dispatch({
        type: "ERROR",
        error: error instanceof Error ? error.message : "通信エラー",
      });
    }
  };

  // Snapshot refs for history save (avoids stale closures without adding to deps)
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const energyLevelRef = useRef(energyLevel);
  energyLevelRef.current = energyLevel;
  const availableTimeRef = useRef(availableTime);
  availableTimeRef.current = availableTime;

  // Auto-save to history when decision is completed
  useEffect(() => {
    if (apiState.status !== "completed" || !apiState.content) return;
    const currentTasks = tasksRef.current;
    const currentEnergy = energyLevelRef.current;
    const currentTime = availableTimeRef.current;
    const saveToHistory = async () => {
      try {
        const firstTask =
          currentTasks.find((t) => t.trim().length > 0) || "Unknown task";
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: firstTask,
            taskDescription: currentTasks.join(", "),
            category: "task-decision",
            urgency: currentEnergy,
            decision: apiState.content,
            provider: apiState.provider,
            model: apiState.model,
            availableTime: currentTime,
            promptTokens: apiState.inputTokens,
            completionTokens: apiState.outputTokens,
            costUsd: calculateCostUsd(
              apiState.provider,
              apiState.model,
              apiState.inputTokens,
              apiState.outputTokens
            ),
          }),
        });
      } catch (err) {
        console.warn(
          "[History] 保存失敗:",
          err instanceof Error ? err.message : String(err)
        );
      }
    };
    saveToHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiState.status, apiState.content]);

  // Fetch compass relevance after decision completes
  useEffect(() => {
    if (
      apiState.status === "completed" &&
      apiState.content &&
      !apiState.compassRelevance
    ) {
      const fetchCompass = async () => {
        try {
          const res = await fetch("/api/compass");
          if (res.ok) {
            const data = await res.json();
            dispatch({
              type: "SET_COMPASS",
              compassRelevance: {
                hasCompass: data.items.length > 0,
                topMatches: [],
              },
            });
          }
        } catch (err) {
          console.warn(
            "[Compass] 取得失敗:",
            err instanceof Error ? err.message : String(err)
          );
        }
      };
      fetchCompass();
    }
  }, [apiState.status, apiState.content, apiState.compassRelevance]);

  // Breakdown handler
  const breakdownAbortRef = useRef<AbortController | null>(null);
  const handleBreakdown = async (task: string) => {
    dispatch({ type: "START_BREAKDOWN" });

    breakdownAbortRef.current?.abort();
    breakdownAbortRef.current = new AbortController();
    const signal = breakdownAbortRef.current.signal;

    try {
      const response = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          availableTime: availableTime ?? 60,
          energyLevel: energyLevel ?? 3,
          provider,
          model,
          stream: true,
          fallback: autoFallback,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        dispatch({
          type: "BREAKDOWN_ERROR",
          error:
            errorData.errors?.join(", ") ??
            errorData.error ??
            "エラーが発生しました",
        });
        return;
      }

      dispatch({ type: "START_BREAKDOWN_STREAMING" });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let lastInputTokens = 0;
      let lastOutputTokens = 0;

      try {
        while (true) {
          if (signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const chunk = JSON.parse(data);
              if (chunk.error) {
                const safeMessage = typeof chunk.error?.error === "string" && chunk.error.error.length < 200
                  ? chunk.error.error
                  : "エラーが発生しました";
                dispatch({ type: "BREAKDOWN_ERROR", error: safeMessage });
                return;
              }
              if (chunk.content) {
                dispatch({
                  type: "APPEND_BREAKDOWN_CONTENT",
                  content: chunk.content,
                });
              }
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
        dispatch({
          type: "COMPLETE_BREAKDOWN",
          inputTokens: lastInputTokens,
          outputTokens: lastOutputTokens,
        });
      }
    } catch (error) {
      if (signal.aborted) return;
      dispatch({
        type: "BREAKDOWN_ERROR",
        error: error instanceof Error ? error.message : "通信エラー",
      });
    }
  };

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      breakdownAbortRef.current?.abort();
    };
  }, []);

  // Reset for new session
  const handleReset = () => {
    abortRef.current?.abort();
    breakdownAbortRef.current?.abort();
    dispatch({ type: "RESET" });
    setTasks([]);
    setAvailableTime(null);
    setEnergyLevel(null);
    setBudgetWarning(null);
  };

  // Continue session — show task completion selection
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
    abortRef.current?.abort();
    breakdownAbortRef.current?.abort();
    dispatch({ type: "RESET" });
    setTasks(remaining);
    setAvailableTime(null);
    setEnergyLevel(null);
    setBudgetWarning(null);
    setIsSelectingCompleted(false);
    setCompletedIndices(new Set());
  };

  const isSubmitting =
    apiState.status === "loading" || apiState.status === "streaming";

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

      {/* === COMPASS SETUP (initial user, no compass) === */}
      {!hasCompass && currentStep === "compass-setup" && (
        <div className="space-y-4">
          <ChatMessage>
            <div className="space-y-2">
              <p>はじめまして。AI意思決定アシスタントです。</p>
              <p>
                あなたの目標や夢を教えてください。
                「将来やりたいこと」「ワクワクすること」など、何でも構いません。
              </p>
              <p>
                これを「羅針盤」として、日々のタスク選びの基準にします。
              </p>
            </div>
          </ChatMessage>

          {/* Compass draft input */}
          <div className="ml-11 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={compassInput}
                onChange={(e) => setCompassInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompassDraft();
                  }
                }}
                placeholder="例: 海外で暮らしたい"
                maxLength={200}
                aria-label="羅針盤の目標を入力"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
              />
              <button
                type="button"
                onClick={addCompassDraft}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                追加
              </button>
            </div>

            {/* Draft chips */}
            {compassDrafts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {compassDrafts.map((draft, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {draft}
                    <button
                      type="button"
                      onClick={() => removeCompassDraft(index)}
                      aria-label={`${draft} を削除`}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              {compassDrafts.length > 0 && (
                <button
                  type="button"
                  onClick={saveCompassItems}
                  disabled={compassSaving}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {compassSaving ? "保存中..." : "羅針盤に登録"}
                </button>
              )}
              <button
                type="button"
                onClick={skipCompassSetup}
                className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                スキップして先にタスク判定する
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              写真やURLも登録できます →{" "}
              <a href="/compass" className="underline hover:text-zinc-600 dark:hover:text-zinc-200">
                羅針盤ページへ
              </a>
            </p>
          </div>
        </div>
      )}

      {/* === TASK INPUT STEP === */}
      {(hasCompass || currentStep !== "compass-setup") &&
        currentStep !== "loading" &&
        apiState.status !== "completed" &&
        apiState.status !== "error" && (
          <div className="space-y-4">
            <ChatMessage>
              <div className="space-y-2">
                {hasCompass ? (
                  <>
                    <p>こんにちは。</p>
                    <CompassSummary items={compassItems!} className="my-2" />
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

      {/* === TIME STEP === */}
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
              <TimeSelector
                value={availableTime}
                onSelect={setAvailableTime}
              />
            </div>
          </div>
        )}

      {/* === ENERGY STEP === */}
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
              <EnergySelector
                value={energyLevel}
                onSelect={setEnergyLevel}
              />
            </div>
          </div>
        )}

      {/* === CONFIRM STEP === */}
      {energyLevel !== null &&
        currentStep === "confirm" && (
          <div ref={confirmRef} className="space-y-4">
            <ChatMessage>
              <div className="space-y-3">
                <p>準備完了です。</p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="mr-1" aria-hidden="true">📋</span>
                    タスク: {tasks.join("、")}
                  </p>
                  <p>
                    <span className="mr-1" aria-hidden="true">⏰</span>
                    時間: {availableTime}分
                  </p>
                  <p>
                    <span className="mr-1" aria-hidden="true">⚡</span>
                    エネルギー: {energyLevel}{" "}
                    {
                      ["", "😩 ぐったり", "😐 まあまあ", "🙂 普通", "😊 元気", "🔥 やる気MAX"][
                        energyLevel
                      ]
                    }
                  </p>
                </div>
              </div>
            </ChatMessage>

            <div className="ml-11 space-y-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {isSubmitting ? "判断中..." : "✨ 最適なタスクを判断する"}
              </button>

              <AdvancedSettings
                provider={provider}
                model={model}
                autoFallback={autoFallback}
                onProviderChange={handleProviderChange}
                onModelChange={setModel}
                onFallbackChange={setAutoFallback}
              />
            </div>
          </div>
        )}

      {/* === LOADING STEP === */}
      {currentStep === "loading" && (
        <div className="space-y-4" role="status" aria-live="polite">
          <ChatMessage>
            <p className="text-zinc-500 dark:text-zinc-400">
              分析しています...
            </p>
          </ChatMessage>
        </div>
      )}

      {/* === RESULT STEP === */}
      {(apiState.status === "completed" ||
        apiState.status === "streaming" ||
        apiState.status === "error") && (
        <div ref={resultRef} className="space-y-4">
          {apiState.status === "error" && (
            <ChatMessage>
              <div role="alert" className="space-y-2">
                <p className="text-red-600 dark:text-red-400">
                  {apiState.error}
                </p>
                <button
                  onClick={() => dispatch({ type: "RESET" })}
                  className="text-sm text-red-600 underline hover:text-red-800 dark:text-red-400"
                >
                  リトライ
                </button>
              </div>
            </ChatMessage>
          )}

          {(apiState.status === "streaming" ||
            apiState.status === "completed") &&
            apiState.content && (
              <>
                <ChatMessage>
                  <p>分析しました。</p>
                </ChatMessage>
                <div className="ml-11" aria-live="polite">
                  <DecisionResult
                    content={apiState.content}
                    isAnxietyMode={
                      (energyLevel ?? 3) <=
                      featuresConfig.anxiety_mode_threshold
                    }
                    provider={apiState.provider || provider}
                    model={apiState.model || model}
                    inputTokens={apiState.inputTokens}
                    outputTokens={apiState.outputTokens}
                    onBreakdown={
                      apiState.status === "completed"
                        ? handleBreakdown
                        : undefined
                    }
                    compassRelevance={apiState.compassRelevance}
                  />
                </div>
              </>
            )}

          {/* Breakdown loading */}
          {apiState.breakdownStatus === "loading" && (
            <div
              role="status"
              aria-busy="true"
              className="ml-11 text-sm text-zinc-500 dark:text-zinc-400"
            >
              タスクを分解中...
            </div>
          )}

          {/* Breakdown error */}
          {apiState.breakdownStatus === "error" && (
            <div
              role="alert"
              className="ml-11 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
            >
              <p className="text-sm text-red-700 dark:text-red-300">
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
                  isAnxietyMode={
                    (energyLevel ?? 3) <=
                    featuresConfig.anxiety_mode_threshold
                  }
                  provider={apiState.provider || provider}
                  model={apiState.model || model}
                  inputTokens={apiState.breakdownInputTokens}
                  outputTokens={apiState.breakdownOutputTokens}
                />
              </div>
            )}

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
            <div className="ml-11 space-y-4 pt-4">
              <ChatMessage animate={false}>
                <p>完了したタスクをタップしてください。</p>
              </ChatMessage>
              <div className="flex flex-wrap gap-2">
                {tasks.map((task, i) => {
                  const isDone = completedIndices.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={isDone}
                      onClick={() => toggleCompletedIndex(i)}
                      className={`rounded-full px-3 py-1.5 text-sm transition-all ${
                        isDone
                          ? "bg-green-100 text-green-700 line-through dark:bg-green-900 dark:text-green-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {isDone && <span className="mr-1" aria-hidden="true">&#10003;</span>}
                      {task}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleProceedAfterComplete}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {completedIndices.size > 0
                    ? `${completedIndices.size}件完了して次の判定へ`
                    : "そのまま次の判定へ"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSelectingCompleted(false)}
                  className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  戻る
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={stepsEndRef} />
    </div>
  );
}
