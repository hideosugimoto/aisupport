"use client";

import { useReducer, useState, useEffect } from "react";
import { DecisionResult } from "./DecisionResult";
import { BreakdownResult } from "./BreakdownResult";
import featuresConfig from "../../config/features.json";
import { calculateCostUsd } from "@/lib/cost/pricing";

type UIState = "idle" | "loading" | "streaming" | "completed" | "error";

interface CompassRelevance {
  hasCompass: boolean;
  topMatches: { title: string; similarity: number }[];
}

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
  | {
      type: "COMPLETE_STREAM";
      inputTokens: number;
      outputTokens: number;
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
    case "COMPLETE_STREAM":
      return {
        ...state,
        status: "completed",
        inputTokens: action.inputTokens,
        outputTokens: action.outputTokens,
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

export function TaskDecisionForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tasks, setTasks] = useState<string[]>([""]);
  const [availableTime, setAvailableTime] = useState(60);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [provider, setProvider] = useState(featuresConfig.default_provider);
  const [model, setModel] = useState(
    featuresConfig.default_model[
      featuresConfig.default_provider as keyof typeof featuresConfig.default_model
    ]
  );
  const [autoFallback, setAutoFallback] = useState(false);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);

  const addTask = () => {
    if (tasks.length < 10) setTasks([...tasks, ""]);
  };
  const removeTask = (index: number) => {
    if (tasks.length > 1) setTasks(tasks.filter((_, i) => i !== index));
  };
  const updateTask = (index: number, value: string) => {
    const updated = [...tasks];
    updated[index] = value;
    setTasks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 予算確認
    try {
      const costResponse = await fetch("/api/cost");
      if (costResponse.ok) {
        const costData = await costResponse.json();
        if (costData.budget) {
          if (costData.budget.alertLevel === "exceeded") {
            const confirmed = window.confirm(
              "月間予算を超過しています。それでも実行しますか？"
            );
            if (!confirmed) {
              return;
            }
          } else if (costData.budget.alertLevel === "warning") {
            setBudgetWarning("予算の80%を超えています。注意してください。");
          } else {
            setBudgetWarning(null);
          }
        }
      }
    } catch {
      // 予算確認に失敗しても処理は継続
    }

    dispatch({ type: "START_LOADING" });

    try {
      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.filter((t) => t.trim().length > 0),
          availableTime,
          energyLevel,
          provider,
          model,
          stream: true,
          fallback: autoFallback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        dispatch({
          type: "ERROR",
          error: errorData.errors?.join(", ") ?? errorData.error ?? "エラーが発生しました",
        });
        return;
      }

      dispatch({ type: "START_STREAMING" });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let lastInputTokens = 0;
      let lastOutputTokens = 0;

      while (true) {
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
              dispatch({ type: "ERROR", error: chunk.error.error });
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

      dispatch({
        type: "COMPLETE",
        provider,
        model,
        inputTokens: lastInputTokens,
        outputTokens: lastOutputTokens,
        isAnxietyMode: energyLevel <= featuresConfig.anxiety_mode_threshold,
      });
    } catch (error) {
      dispatch({
        type: "ERROR",
        error: error instanceof Error ? error.message : "通信エラー",
      });
    }
  };

  // Auto-save to history when decision is completed
  useEffect(() => {
    if (state.status === "completed" && state.content) {
      const saveToHistory = async () => {
        try {
          const firstTask = tasks.find((t) => t.trim().length > 0) || "Unknown task";
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskTitle: firstTask,
              taskDescription: tasks.join(", "),
              category: "task-decision",
              urgency: energyLevel,
              decision: state.content,
              provider: state.provider,
              model: state.model,
              availableTime,
              promptTokens: state.inputTokens,
              completionTokens: state.outputTokens,
              costUsd: calculateCostUsd(state.provider, state.model, state.inputTokens, state.outputTokens),
            }),
          });
          // Silent success: history save is non-critical
        } catch {
          // Silent failure: history save is non-critical
        }
      };
      saveToHistory();
    }
  }, [state.status, state.content, state.provider, state.model, state.inputTokens, state.outputTokens, tasks, energyLevel, availableTime]);

  // Fetch compass relevance after decision completes
  useEffect(() => {
    if (state.status === "completed" && state.content && !state.compassRelevance) {
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
        } catch {
          // Non-critical — skip compass display
        }
      };
      fetchCompass();
    }
  }, [state.status, state.content, state.compassRelevance]);

  const handleBreakdown = async (task: string) => {
    dispatch({ type: "START_BREAKDOWN" });

    try {
      const response = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          availableTime,
          energyLevel,
          provider,
          model,
          stream: true,
          fallback: autoFallback,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        dispatch({
          type: "BREAKDOWN_ERROR",
          error: errorData.errors?.join(", ") ?? errorData.error ?? "エラーが発生しました",
        });
        return;
      }

      dispatch({ type: "START_BREAKDOWN_STREAMING" });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let lastInputTokens = 0;
      let lastOutputTokens = 0;

      while (true) {
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
              dispatch({ type: "BREAKDOWN_ERROR", error: chunk.error.error });
              return;
            }
            if (chunk.content) {
              dispatch({ type: "APPEND_BREAKDOWN_CONTENT", content: chunk.content });
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

      dispatch({
        type: "COMPLETE_BREAKDOWN",
        inputTokens: lastInputTokens,
        outputTokens: lastOutputTokens,
      });
    } catch (error) {
      dispatch({
        type: "BREAKDOWN_ERROR",
        error: error instanceof Error ? error.message : "通信エラー",
      });
    }
  };

  const isSubmitting = state.status === "loading" || state.status === "streaming";

  return (
    <div className="space-y-6">
      {/* 予算警告バナー */}
      {budgetWarning && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            {budgetWarning}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* タスク候補 */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            タスク候補
          </label>
          {tasks.map((task, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                id={`task-${index}`}
                type="text"
                value={task}
                onChange={(e) => updateTask(index, e.target.value)}
                maxLength={200}
                placeholder={`タスク ${index + 1}`}
                aria-label={`タスク ${index + 1}`}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {tasks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTask(index)}
                  aria-label={`タスク ${index + 1} を削除`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
                >
                  -
                </button>
              )}
            </div>
          ))}
          {tasks.length < 10 && (
            <button
              type="button"
              onClick={addTask}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              + タスクを追加
            </button>
          )}
        </div>

        {/* 利用可能時間 */}
        <div>
          <label htmlFor="available-time" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            利用可能時間（分）
          </label>
          <input
            id="available-time"
            type="number"
            min={1}
            max={1440}
            value={availableTime}
            onChange={(e) => setAvailableTime(Number(e.target.value))}
            className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* エネルギー状態 */}
        <div>
          <label id="energy-label" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            エネルギー状態
          </label>
          <div className="flex gap-2" role="radiogroup" aria-labelledby="energy-label">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={energyLevel === level}
                aria-label={`エネルギーレベル ${level}`}
                onClick={() => setEnergyLevel(level)}
                className={`w-11 h-11 rounded-lg text-sm font-medium border transition-colors ${
                  energyLevel === level
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          {energyLevel <= featuresConfig.anxiety_mode_threshold && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              低エネルギーモードが有効になります
            </p>
          )}
        </div>

        {/* エンジン選択 */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            AIエンジン
          </label>
          <div className="flex gap-2">
            {featuresConfig.enabled_providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setModel(
                    featuresConfig.default_model[
                      p as keyof typeof featuresConfig.default_model
                    ]
                  );
                }}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                  provider === p
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* モデル選択 */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            モデル
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {(
              featuresConfig.available_models[
                provider as keyof typeof featuresConfig.available_models
              ] ?? []
            ).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* フォールバックトグル */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            自動フォールバック（エラー時に他のエンジンに切り替え）
          </label>
        </div>

        {/* 送信 */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isSubmitting ? "判断中..." : "最適タスクを判断"}
        </button>
      </form>

      {/* 結果エリア */}
      <div aria-live="polite">
        {/* エラー表示 */}
        {state.status === "error" && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800 dark:text-red-400"
            >
              リトライ
            </button>
          </div>
        )}

        {/* 結果表示 */}
        {(state.status === "streaming" || state.status === "completed") &&
          state.content && (
            <DecisionResult
              content={state.content}
              isAnxietyMode={
                energyLevel <= featuresConfig.anxiety_mode_threshold
              }
              provider={state.provider || provider}
              model={state.model || model}
              inputTokens={state.inputTokens}
              outputTokens={state.outputTokens}
              onBreakdown={state.status === "completed" ? handleBreakdown : undefined}
              compassRelevance={state.compassRelevance}
            />
          )}

        {/* タスク分解ローディング */}
        {state.breakdownStatus === "loading" && (
          <div role="status" aria-busy="true" className="text-sm text-zinc-500 dark:text-zinc-400">
            タスクを分解中...
          </div>
        )}

        {/* タスク分解エラー */}
        {state.breakdownStatus === "error" && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-700 dark:text-red-300">{state.breakdownError}</p>
          </div>
        )}

        {/* タスク分解結果 */}
        {(state.breakdownStatus === "streaming" || state.breakdownStatus === "completed") &&
          state.breakdownContent && (
            <BreakdownResult
              content={state.breakdownContent}
              isAnxietyMode={energyLevel <= featuresConfig.anxiety_mode_threshold}
              provider={state.provider || provider}
              model={state.model || model}
              inputTokens={state.breakdownInputTokens}
              outputTokens={state.breakdownOutputTokens}
            />
          )}
      </div>
    </div>
  );
}
