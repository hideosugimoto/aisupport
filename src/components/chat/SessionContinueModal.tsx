"use client";

import { ChatMessage } from "../ChatMessage";

interface SessionContinueModalProps {
  tasks: string[];
  completedIndices: Set<number>;
  onToggle: (index: number) => void;
  onProceed: () => void;
  onCancel: () => void;
}

export function SessionContinueModal({
  tasks,
  completedIndices,
  onToggle,
  onProceed,
  onCancel,
}: SessionContinueModalProps) {
  return (
    <div className="ml-11 space-y-4 pt-4">
      <ChatMessage animate={false}>
        <p>完了したタスクをタップしてください。</p>
      </ChatMessage>
      <div className="flex flex-wrap gap-2">
        {tasks.map((task, i) => {
          const isDone = completedIndices.has(i);
          return (
            <button
              key={`task-complete-${task}-${i}`}
              type="button"
              aria-pressed={isDone}
              onClick={() => onToggle(i)}
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
          onClick={onProceed}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {completedIndices.size > 0
            ? `${completedIndices.size}件完了して次の判定へ`
            : "そのまま次の判定へ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          戻る
        </button>
      </div>
    </div>
  );
}
