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
                  ? "bg-forest-bg text-forest line-through"
                  : "bg-bg2 text-text"
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
          className="rounded-lg bg-root-bg px-4 py-2 text-sm font-medium text-root-color transition-colors hover:bg-forest"
        >
          {completedIndices.size > 0
            ? `${completedIndices.size}件完了して次の判定へ`
            : "そのまま次の判定へ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-text3 hover:text-text2"
        >
          戻る
        </button>
      </div>
    </div>
  );
}
