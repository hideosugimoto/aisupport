"use client";

import { useState } from "react";

interface TimeSelectorProps {
  value: number | null;
  onSelect: (minutes: number) => void;
}

const PRESETS = [
  { label: "30分", minutes: 30 },
  { label: "1時間", minutes: 60 },
  { label: "2時間", minutes: 120 },
  { label: "3時間+", minutes: 180 },
] as const;

export function TimeSelector({ value, onSelect }: TimeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const isPresetSelected = (minutes: number) =>
    value === minutes && !showCustom;

  const isCustomSelected =
    showCustom &&
    value !== null &&
    !PRESETS.some((p) => p.minutes === value);

  function handlePresetClick(minutes: number) {
    setShowCustom(false);
    setCustomValue("");
    onSelect(minutes);
  }

  function handleCustomClick() {
    setShowCustom(true);
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setCustomValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 1440) {
      onSelect(parsed);
    }
  }

  const baseButton =
    "rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors";
  const activeButton =
    "rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 transition-colors";

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map(({ label, minutes }) => (
        <button
          key={minutes}
          type="button"
          onClick={() => handlePresetClick(minutes)}
          className={isPresetSelected(minutes) ? activeButton : baseButton}
          aria-label={`${label}を選択`}
          aria-pressed={isPresetSelected(minutes)}
        >
          {label}
        </button>
      ))}

      <button
        type="button"
        onClick={handleCustomClick}
        className={isCustomSelected ? activeButton : baseButton}
        aria-label="カスタムの時間を入力"
        aria-pressed={showCustom}
      >
        カスタム
      </button>

      {showCustom && (
        <input
          type="number"
          min={1}
          max={1440}
          placeholder="分を入力"
          value={customValue}
          onChange={handleCustomChange}
          className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          aria-label="カスタム時間（分）"
        />
      )}
    </div>
  );
}
