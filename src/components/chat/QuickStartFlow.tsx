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
            className="w-full rounded-lg border border-border-brand bg-surface px-4 py-3 text-sm text-text placeholder:text-text3 focus:border-text2 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSubmit();
            }}
          />
        </div>

        {/* Time presets */}
        {task.trim().length > 0 && (
          <div>
            <p className="mb-2 text-sm text-text2">
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
                      ? "bg-root-bg text-root-color"
                      : "border border-border-brand text-text hover:bg-bg2"
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
            <p className="mb-2 text-sm text-text2">
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
                      ? "bg-root-bg text-root-color"
                      : "border border-border-brand text-text hover:bg-bg2"
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
              className="rounded-lg bg-root-bg px-6 py-2.5 text-sm font-medium text-root-color transition-colors hover:bg-forest"
            >
              判定する
            </button>
          </div>
        )}

        {/* Switch to full flow */}
        <button
          type="button"
          onClick={onSwitchToFull}
          className="text-xs text-text3 underline hover:text-text2"
        >
          もっと詳しく入力する
        </button>
      </div>
    </div>
  );
}
