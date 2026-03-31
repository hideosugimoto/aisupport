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
          className="flex-1 rounded-lg border border-border-brand px-3 py-2 text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-forest disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={addTask}
          disabled={isMaxReached}
          className="rounded-lg bg-root-bg px-4 py-2 text-sm text-root-color hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50"
        >
          追加
        </button>
      </div>

      {isMaxReached && (
        <p className="mt-1 text-xs text-text2">
          タスクは最大{maxTasks}件まで追加できます
        </p>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tasks.map((task, index) => (
            <span
              key={`${task}-${index}`}
              className="inline-flex items-center gap-1 rounded-full bg-bg2 px-3 py-1 text-sm text-text"
            >
              {task}
              <button
                type="button"
                onClick={() => removeTask(index)}
                aria-label={`${task} を削除`}
                className="text-text3 hover:text-text2"
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
