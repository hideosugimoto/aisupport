"use client";

import { useState } from "react";
import Link from "next/link";
import { CompareResult as CompareResultComponent } from "@/components/CompareResult";
import type { CompareResult } from "@/lib/compare/parallel-engine";
import featuresConfig from "../../../config/features.json";

export default function ComparePage() {
  const [tasks, setTasks] = useState<string[]>([""]);
  const [availableTime, setAvailableTime] = useState(120);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [models, setModels] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of featuresConfig.enabled_providers) {
      initial[p] = featuresConfig.default_model[p as keyof typeof featuresConfig.default_model];
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTask = () => {
    setTasks([...tasks, ""]);
  };

  const updateTask = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index] = value;
    setTasks(newTasks);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: tasks.filter((t) => t.trim().length > 0),
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ネットワークエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              エンジン比較
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/history"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                履歴
              </Link>
              <Link
                href="/cost"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                コスト確認
              </Link>
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定に戻る
              </Link>
            </nav>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            全エンジンで並列判定し、比較します
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                タスク候補
              </label>
              {tasks.map((task, index) => (
                <div key={index} className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => updateTask(index, e.target.value)}
                    placeholder={`タスク${index + 1}`}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
                  className="mt-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  + タスクを追加
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  利用可能時間（分）
                </label>
                <input
                  type="number"
                  value={availableTime}
                  onChange={(e) => setAvailableTime(Number(e.target.value))}
                  min="1"
                  max="1440"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  エネルギー状態（1-5）
                </label>
                <input
                  type="number"
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(Number(e.target.value))}
                  min="1"
                  max="5"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* モデル選択（各プロバイダー） */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                各エンジンのモデル
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {featuresConfig.enabled_providers.map((p) => (
                  <div key={p}>
                    <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                      {p}
                    </label>
                    <select
                      value={models[p] ?? ""}
                      onChange={(e) =>
                        setModels((prev) => ({ ...prev, [p]: e.target.value }))
                      }
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {(
                        featuresConfig.available_models[
                          p as keyof typeof featuresConfig.available_models
                        ] ?? []
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? "比較中..." : "全エンジンで比較"}
            </button>
          </div>
        </form>

        {results.length > 0 && <CompareResultComponent results={results} />}
      </div>
    </div>
  );
}
