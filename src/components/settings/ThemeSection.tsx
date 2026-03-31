"use client";

import { useTheme, type Theme } from "@/components/ThemeProvider";

const THEMES: { value: Theme; label: string; description: string; preview: { bg: string; accent: string; text: string } }[] = [
  {
    value: "base",
    label: "Base",
    description: "万人向け。自然色ベース",
    preview: { bg: "#f7f5f2", accent: "#285240", text: "#2a2520" },
  },
  {
    value: "feminine",
    label: "Feminine",
    description: "桜・薔薇・ラベンダー",
    preview: { bg: "#faf6f4", accent: "#a05068", text: "#2e2220" },
  },
  {
    value: "dark",
    label: "Dark",
    description: "夜間・集中・プレミアム",
    preview: { bg: "#1a1814", accent: "#4a9068", text: "#f0ece4" },
  },
];

export function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="rounded-lg border border-border-brand bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium text-text">
        テーマ
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const isSelected = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              aria-pressed={isSelected}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-forest shadow-sm"
                  : "border-border-brand hover:border-border2"
              }`}
            >
              {/* Color preview */}
              <div
                className="mb-3 flex h-10 items-center gap-1.5 rounded-lg px-3"
                style={{ background: t.preview.bg }}
              >
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ background: t.preview.accent }}
                />
                <div
                  className="h-2 w-12 rounded"
                  style={{ background: t.preview.text, opacity: 0.3 }}
                />
                <div
                  className="h-2 w-8 rounded"
                  style={{ background: t.preview.text, opacity: 0.15 }}
                />
              </div>

              <p className="text-sm font-semibold text-text">
                {t.label}
              </p>
              <p className="mt-0.5 text-xs text-text2">
                {t.description}
              </p>

              {isSelected && (
                <span className="mt-2 inline-block text-xs font-medium text-forest">
                  &#10003; 使用中
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
