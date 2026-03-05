"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TaskDecisionRecord } from "@/lib/db/types";

interface HistoryListProps {
  initialItems: TaskDecisionRecord[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
}

export function HistoryList({
  initialItems,
  initialTotal,
  initialPage,
  initialLimit,
}: HistoryListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const totalPages = Math.ceil(total / limit);

  const fetchHistory = async (newPage: number, query: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: newPage.toString(),
        limit: limit.toString(),
      });
      if (query.trim()) {
        params.append("q", query.trim());
      }

      const response = await fetch(`/api/history?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (error) {
      console.warn("[History] フェッチ失敗:", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(1, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    fetchHistory(newPage, searchQuery);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const parseTasks = useCallback((tasksInput: string) => {
    try {
      const tasks = JSON.parse(tasksInput);
      return Array.isArray(tasks) ? tasks : [];
    } catch {
      return [];
    }
  }, []);

  const handleContinue = (item: TaskDecisionRecord) => {
    const tasks = parseTasks(item.tasksInput);
    let taskStrings: string[];
    if (tasks.length === 1 && tasks[0]?.description) {
      // Old format: single object with comma-joined description
      taskStrings = (tasks[0].description as string)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else {
      // New format: multiple objects with title
      taskStrings = tasks.map((t: { title: string }) => t.title).filter(Boolean);
    }
    sessionStorage.setItem(
      "dashboard-restore",
      JSON.stringify({ tasks: taskStrings })
    );
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <label htmlFor="history-search" className="sr-only">キーワードで検索</label>
        <input
          id="history-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          検索
        </button>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          読み込み中...
        </div>
      )}

      {/* Results count */}
      {!isLoading && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {total}件の履歴
        </div>
      )}

      {/* History list */}
      <div className="space-y-4">
        {items.map((item) => {
          const isExpanded = expandedIds.has(item.id);
          const tasks = parseTasks(item.tasksInput);
          const firstTask = tasks[0] || { title: "不明", description: "" };

          return (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                aria-expanded={expandedIds.has(item.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      {firstTask.title || "タスク"}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>エネルギー: {item.energyLevel}/5</span>
                      <span>時間: {item.availableTime}分</span>
                      <span>
                        {item.provider} / {item.model}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleString("ja-JP")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                  {/* Tasks input */}
                  {tasks.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        タスク候補
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {tasks.map((task: { title: string; description?: string }, idx: number) => (
                          <li key={`${task.title}-${idx}`}>
                            {task.title}
                            {task.description && (
                              <span className="ml-2 text-zinc-500">
                                - {task.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Decision */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      AI判定結果
                    </h4>
                    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                      <pre className="whitespace-pre-wrap text-xs">
                        {item.result}
                      </pre>
                    </div>
                  </div>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={() => handleContinue(item)}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    このタスクで続ける
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && !isLoading && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {searchQuery ? "検索結果がありません" : "履歴がありません"}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            前へ
          </button>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages || isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
