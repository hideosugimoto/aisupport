"use client";

import { useState, useEffect, useCallback } from "react";
import type { CompassItem } from "@/lib/reducers/decision-reducer";

export function useCompassSetup() {
  const [compassItems, setCompassItems] = useState<CompassItem[] | null>(null);
  const [compassInput, setCompassInput] = useState("");
  const [compassDrafts, setCompassDrafts] = useState<string[]>([]);
  const [compassSaving, setCompassSaving] = useState(false);

  const hasCompass = compassItems !== null && compassItems.length > 0;
  const isCompassLoading = compassItems === null;

  useEffect(() => {
    async function fetchCompass() {
      try {
        const res = await fetch("/api/compass");
        if (res.ok) {
          const data = await res.json();
          setCompassItems(data.items ?? []);
        } else {
          setCompassItems([]);
        }
      } catch {
        setCompassItems([]);
      }
    }
    fetchCompass();
  }, []);

  const addDraft = useCallback(() => {
    const trimmed = compassInput.trim();
    if (!trimmed || compassDrafts.length >= 10) return;
    setCompassDrafts((prev) => [...prev, trimmed]);
    setCompassInput("");
  }, [compassInput, compassDrafts.length]);

  const removeDraft = useCallback((index: number) => {
    setCompassDrafts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const saveDrafts = useCallback(async () => {
    if (compassDrafts.length === 0) return;
    setCompassSaving(true);
    try {
      await Promise.all(
        compassDrafts.map((title) =>
          fetch("/api/compass", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "text", title, content: title }),
          })
        )
      );
      const res = await fetch("/api/compass");
      if (res.ok) {
        const data = await res.json();
        setCompassItems(data.items ?? []);
      }
      setCompassDrafts([]);
    } catch (err) {
      console.warn("[Compass] 登録失敗:", err instanceof Error ? err.message : String(err));
    } finally {
      setCompassSaving(false);
    }
  }, [compassDrafts]);

  const skip = useCallback(() => {
    setCompassItems([]);
  }, []);

  return {
    compassItems,
    setCompassItems,
    compassInput,
    setCompassInput,
    compassDrafts,
    compassSaving,
    hasCompass,
    isCompassLoading,
    addDraft,
    removeDraft,
    saveDrafts,
    skip,
  };
}
