"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "onboarding-completed";

const steps = [
  {
    number: "1",
    title: "マイゴールを設定しよう",
    description:
      "あなたの目標・夢・価値観を登録しましょう。登録した内容が、全ての意思決定の判断基準になります。",
  },
  {
    number: "2",
    title: "タスクを判定しよう",
    description:
      "今日やるべきことを入力すると、AIがマイゴールに基づいて最適な優先順位を提案します。",
  },
  {
    number: "3",
    title: "比較・振り返りで精度UP",
    description:
      "複数のAIエンジンで同時に比較したり、週次レビューで振り返ることで、判断の質を高められます。",
  },
];

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-border-brand bg-surface p-6 shadow-lg">
        {/* Progress */}
        <div className="mb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-10 rounded-full ${
                i <= currentStep ? "bg-root-bg" : "bg-bg2"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-root-bg text-lg font-bold text-root-color">
            {step.number}
          </div>
          <h2 className="mb-3 text-lg font-bold text-text">{step.title}</h2>
          <p className="mb-8 text-sm leading-relaxed text-text2">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {isFirst ? (
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-lg px-4 py-2 text-sm text-text3 hover:text-text2"
            >
              スキップ
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="rounded-lg px-4 py-2 text-sm text-text2 hover:text-text"
            >
              前へ
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={handleComplete}
              className="rounded-lg bg-root-bg px-6 py-2 text-sm font-medium text-root-color hover:opacity-90"
            >
              始める
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="rounded-lg bg-root-bg px-6 py-2 text-sm font-medium text-root-color hover:opacity-90"
            >
              次へ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
