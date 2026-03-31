"use client";

import { useState } from "react";
import { ChatMessage } from "../ChatMessage";

interface QuickStartFlowProps {
  onSubmit: (data: {
    tasks: string[];
    availableTime: number;
    energyLevel: number;
  }) => void;
  onSwitchToFull: () => void;
}

const TIME_PRESETS = [
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
] as const;

const ENERGY_PRESETS = [
  { label: "低い", value: 2, icon: "\uD83D\uDE2E\u200D\uD83D\uDCA8" },
  { label: "ふつう", value: 3, icon: "\uD83D\uDE10" },
  { label: "元気", value: 5, icon: "\uD83D\uDD25" },
] as const;

export function QuickStartFlow({ onSubmit, onSwitchToFull }: QuickStartFlowProps) {
  const [task, setTask] = useState("");
  const [time, setTime] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);

  const canSubmit = task.trim().length > 0 && time !== null && energy !== null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      tasks: [task.trim()],
      availableTime: time,
      energyLevel: energy,
    });
  };

  return (
    <div className="space-y-6">
      <ChatMessage>
        <p>今日やりたいことを1つ教えてください。すぐに最適な行動を提案します。</p>
      </ChatMessage>

      <div className="ml-11 space-y-5">
        {/* Task input */}
        <div>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="例: 企画書を書く"
            aria-label="今日やりたいこと"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSubmit();
            }}
          />
        </div>

        {/* Time presets */}
        {task.trim().length > 0 && (
          <div>
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
              使える時間は？
            </p>
            <div className="flex gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setTime(preset.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    time === preset.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Energy presets */}
        {time !== null && (
          <div>
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
              今の調子は？
            </p>
            <div className="flex gap-2">
              {ENERGY_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setEnergy(preset.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    energy === preset.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {preset.icon} {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        {canSubmit && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              判定する
            </button>
          </div>
        )}

        {/* Switch to full flow */}
        <button
          type="button"
          onClick={onSwitchToFull}
          className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          もっと詳しく入力する
        </button>
      </div>
    </div>
  );
}
