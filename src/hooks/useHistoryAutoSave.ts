"use client";

import { useEffect, useRef } from "react";
import { calculateCostUsd } from "@/lib/cost/pricing";

interface AutoSaveParams {
  status: string;
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  tasks: string[];
  energyLevel: number | null;
  availableTime: number | null;
}

export function useHistoryAutoSave(params: AutoSaveParams) {
  const tasksRef = useRef(params.tasks);
  tasksRef.current = params.tasks;
  const energyLevelRef = useRef(params.energyLevel);
  energyLevelRef.current = params.energyLevel;
  const availableTimeRef = useRef(params.availableTime);
  availableTimeRef.current = params.availableTime;

  useEffect(() => {
    if (params.status !== "completed" || !params.content) return;
    const currentTasks = tasksRef.current;
    const currentEnergy = energyLevelRef.current;
    const currentTime = availableTimeRef.current;
    const saveToHistory = async () => {
      try {
        const firstTask =
          currentTasks.find((t) => t.trim().length > 0) || "Unknown task";
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: firstTask,
            taskDescription: currentTasks.join(", "),
            tasks: currentTasks,
            category: "task-decision",
            urgency: currentEnergy,
            decision: params.content,
            provider: params.provider,
            model: params.model,
            availableTime: currentTime,
            promptTokens: params.inputTokens,
            completionTokens: params.outputTokens,
            costUsd: calculateCostUsd(
              params.provider,
              params.model,
              params.inputTokens,
              params.outputTokens
            ),
          }),
        });
      } catch (err) {
        console.warn(
          "[History] 保存失敗:",
          err instanceof Error ? err.message : String(err)
        );
      }
    };
    saveToHistory();
  }, [params.status, params.content, params.provider, params.model, params.inputTokens, params.outputTokens]);
}
