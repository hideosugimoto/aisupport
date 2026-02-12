"use client";

import { Fragment } from "react";

interface DecisionResultProps {
  content: string;
  isAnxietyMode: boolean;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function DecisionResult({
  content,
  isAnxietyMode,
  provider,
  model,
  inputTokens,
  outputTokens,
}: DecisionResultProps) {
  return (
    <div className="mt-6 space-y-4">
      {isAnxietyMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          低エネルギーモードで回答しています
        </div>
      )}
      <div className="prose prose-zinc dark:prose-invert max-w-none rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <MarkdownContent text={content} />
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          {provider} / {model}
        </span>
        <span>
          入力: {inputTokens} / 出力: {outputTokens} tokens
        </span>
      </div>
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.JSX.Element[] = [];

  lines.forEach((line, index) => {
    // h3 heading (### )
    if (line.startsWith("### ")) {
      const content = line.substring(4);
      elements.push(
        <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </h3>
      );
      return;
    }

    // h2 heading (## )
    if (line.startsWith("## ")) {
      const content = line.substring(3);
      elements.push(
        <h2 key={index} className="text-xl font-bold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </h2>
      );
      return;
    }

    // Numbered list (1. )
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(
        <li key={index} className="ml-4">
          {formatInlineMarkdown(numberedMatch[2])}
        </li>
      );
      return;
    }

    // Bullet list (- )
    if (line.startsWith("- ")) {
      const content = line.substring(2);
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {formatInlineMarkdown(content)}
        </li>
      );
      return;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<br key={index} />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={index}>{formatInlineMarkdown(line)}</p>
    );
  });

  return <>{elements}</>;
}

function formatInlineMarkdown(text: string): React.JSX.Element | string {
  // Handle **bold** text
  const parts: (React.JSX.Element | string)[] = [];
  let currentIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    // Add the bold element
    parts.push(
      <strong key={`bold-${match.index}`}>{match[1]}</strong>
    );
    currentIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  // If no matches, return the original text
  if (parts.length === 0) {
    return text;
  }

  // If only one part and it's text, return as is
  if (parts.length === 1 && typeof parts[0] === "string") {
    return parts[0];
  }

  return <>{parts}</>;
}
