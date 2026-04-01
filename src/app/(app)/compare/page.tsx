"use client";

import { useState, useEffect } from "react";
import { SubNav } from "@/components/SubNav";
import { CompareResult as CompareResultComponent } from "@/components/CompareResult";
import type { CompareResult } from "@/lib/compare/parallel-engine";
import type { CompassRelevance } from "@/lib/compass/types";
import featuresConfig from "../../../../config/features.json";

interface TaskItem {
  id: string;
  value: string;
}

let taskIdCounter = 0;
function createTask(value = ""): TaskItem {
  return { id: `task-${++taskIdCounter}`, value };
}

export default function ComparePage() {
  const [tasks, setTasks] = useState<TaskItem[]>(() => [createTask()]);
  const [availableTime, setAvailableTime] = useState(120);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [compassRelevance, setCompassRelevance] = useState<CompassRelevance | undefined>();
  const [models, setModels] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of featuresConfig.enabled_providers) {
      initial[p] = featuresConfig.default_model[p as keyof typeof featuresConfig.default_model];
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSelectModel, setCanSelectModel] = useState(false);

  useEffect(() => {
    fetch("/api/billing/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCanSelectModel(data.canSelectModel ?? false); })
      .catch(() => {});
  }, []);

  const addTask = () => {
    setTasks([...tasks, createTask()]);
  };

  const updateTask = (id: string, value: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, value } : t)));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setCompassRelevance(undefined);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.map((t) => t.value).filter((v) => v.trim().length > 0),
          availableTime,
          energyLevel,
          models,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.errors?.join(", ") || data.error || "エラーが発生しました");
        return;
      }

      setResults(data.results);
      setCompassRelevance(data.compassRelevance);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ネットワークエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              エンジン比較
            </h1>
            <SubNav links={[
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-2 text-sm text-text2">
            全エンジンで並列判定し、比較します
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border-brand bg-surface p-6"
        >
          <div className="space-y-6">
            <div>
              <span className="mb-2 block text-sm font-medium text-text">
                タスク候補
              </span>
              {tasks.map((task, index) => (
                <div key={task.id} className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={task.value}
                    onChange={(e) => updateTask(task.id, e.target.value)}
                    placeholder={`タスク${index + 1}`}
                    aria-label={`タスク${index + 1}`}
                    className="flex-1 rounded-lg border border-border-brand bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
                  />
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="rounded-lg border border-border-brand px-3 text-sm text-text hover:bg-bg2"
                    >
                      削除
                    </button>
                  )}
                </div>
              ))}
              {tasks.length < 10 && (
                <button
                  type="button"
                  onClick={addTask}
                  className="mt-2 text-sm text-text2 hover:text-text"
                >
                  + タスクを追加
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="compare-time" className="mb-2 block text-sm font-medium text-text">
                  利用可能時間（分）
                </label>
                <input
                  id="compare-time"
                  type="number"
                  value={availableTime}
                  onChange={(e) => setAvailableTime(Number(e.target.value))}
                  min="1"
                  max="1440"
                  className="w-full rounded-lg border border-border-brand bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
                />
              </div>

              <div>
                <label htmlFor="compare-energy" className="mb-2 block text-sm font-medium text-text">
                  エネルギー状態（1-5）
                </label>
                <input
                  id="compare-energy"
                  type="number"
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(Number(e.target.value))}
                  min="1"
                  max="5"
                  className="w-full rounded-lg border border-border-brand bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
                />
              </div>
            </div>

            {/* モデル選択（Pro or BYOKのみ表示） */}
            {canSelectModel && (
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-text">
                  各エンジンのモデル
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {featuresConfig.enabled_providers.map((p) => (
                    <div key={p}>
                      <label htmlFor={`model-${p}`} className="mb-1 block text-xs text-text2">
                        {(featuresConfig.provider_labels as Record<string, { name: string }>)[p]?.name ?? p}
                      </label>
                      <select
                        id={`model-${p}`}
                        value={models[p] ?? ""}
                        onChange={(e) =>
                          setModels((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-border-brand bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-root-bg"
                      >
                        {(
                          featuresConfig.available_models[
                            p as keyof typeof featuresConfig.available_models
                          ] ?? []
                        ).map((m) => {
                          const ml = (featuresConfig.model_labels as Record<string, { name: string; description: string }>)[m];
                          return (
                            <option key={m} value={m}>
                              {ml?.name ?? m} — {ml?.description ?? ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-amber-bd bg-amber-bg p-3 text-sm text-amber-brand">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-root-bg px-4 py-3 font-medium text-root-color transition-colors hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "比較中..." : "全エンジンで比較"}
            </button>
          </div>
        </form>

        {results.length > 0 && <CompareResultComponent results={results} compassRelevance={compassRelevance} />}
      </div>
    </div>
  );
}
