"use client";

import { useEffect, useState } from "react";

interface ChatMessageProps {
  children: React.ReactNode;
  animate?: boolean;
}

export function ChatMessage({ children, animate = true }: ChatMessageProps) {
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => {
      setVisible(true);
    });
    return () => cancelAnimationFrame(id);
  }, [animate]);

  return (
    <div
      className={`flex items-start gap-3 motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out ${
        visible ? "opacity-100 translate-y-0" : "motion-safe:opacity-0 motion-safe:translate-y-4"
      }`}
    >
      {/* Robot icon */}
      <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-base leading-none select-none">
        🤖
      </div>

      {/* Message bubble */}
      <div className="rounded-2xl rounded-tl-sm bg-zinc-50 px-4 py-3 text-sm text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50">
        {children}
      </div>
    </div>
  );
}
