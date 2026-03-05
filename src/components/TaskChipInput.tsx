"use client";

import { useState } from "react";

interface TaskChipInputProps {
  tasks: string[];
  onTasksChange: (tasks: string[]) => void;
  maxTasks?: number;
}

export function TaskChipInput({
  tasks,
  onTasksChange,
  maxTasks = 10,
}: TaskChipInputProps) {
  const [inputValue, setInputValue] = useState("");

  const isMaxReached = tasks.length >= maxTasks;

  function addTask() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (isMaxReached) return;
    onTasksChange([...tasks, trimmed]);
    setInputValue("");
  }

  function removeTask(index: number) {
    const updated = tasks.filter((_, i) => i !== index);
    onTasksChange(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isMaxReached}
          placeholder="例: 企画書の作成"
          maxLength={200}
          aria-label="タスクを入力"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={isMaxReached}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          追加
        </button>
      </div>

      {isMaxReached && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          タスクは最大{maxTasks}件まで追加できます
        </p>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tasks.map((task, index) => (
            <span
              key={`${task}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {task}
              <button
                type="button"
                onClick={() => removeTask(index)}
                aria-label={`${task} を削除`}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
