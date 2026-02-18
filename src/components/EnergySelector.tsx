"use client";

import { useRef } from "react";

interface EnergySelectorProps {
  value: number | null;
  onSelect: (level: number) => void;
}

const ENERGY_LEVELS = [
  { level: 1, emoji: "😩", label: "ぐったり" },
  { level: 2, emoji: "😐", label: "まあまあ" },
  { level: 3, emoji: "🙂", label: "普通" },
  { level: 4, emoji: "😊", label: "元気" },
  { level: 5, emoji: "🔥", label: "やる気MAX" },
] as const;

const ANXIETY_MODE_THRESHOLD = 2;

export function EnergySelector({ value, onSelect }: EnergySelectorProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      const current = value ?? 0;
      const next = Math.min(5, current + 1);
      onSelect(next);
      buttonRefs.current[next - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      const current = value ?? 6;
      const prev = Math.max(1, current - 1);
      onSelect(prev);
      buttonRefs.current[prev - 1]?.focus();
      e.preventDefault();
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="エネルギー状態"
        className="flex flex-wrap gap-2"
        onKeyDown={handleKeyDown}
      >
        {ENERGY_LEVELS.map(({ level, emoji, label }) => {
          const isSelected = value === level;
          return (
            <button
              key={level}
              ref={(el) => {
                buttonRefs.current[level - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (value === null && level === 1) ? 0 : -1}
              onClick={() => onSelect(level)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-sm min-w-[4.5rem] transition-colors ${
                isSelected
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-xs">{label}</span>
            </button>
          );
        })}
      </div>
      {value !== null && value <= ANXIETY_MODE_THRESHOLD && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          無理のないタスクを提案します
        </p>
      )}
    </div>
  );
}
