"use client";

interface MarkdownContentProps {
  text: string;
  headingOffset?: number;
}

export function MarkdownContent({ text, headingOffset = 0 }: MarkdownContentProps) {
  const lines = text.split("\n");
  // NOTE: ローカル配列mutationはパーサー関数のため意図的。stateには公開しない。
  // index key は許容: 行は静的なMarkdown文字列からパースされ、並び替えは発生しない
  const elements: React.JSX.Element[] = [];
  let listItems: React.JSX.Element[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      const listClass = listType === "ul" ? "ml-4 list-disc space-y-1" : "ml-4 list-decimal space-y-1";
      elements.push(
        <ListTag key={`list-${elements.length}`} className={listClass}>
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, index) => {
    // h3 heading (### )
    if (line.startsWith("### ")) {
      flushList();
      const content = line.substring(4);
      const level = Math.min(3 + headingOffset, 6);
      const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      elements.push(
        <HeadingTag key={index} className="text-lg font-semibold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </HeadingTag>
      );
      return;
    }

    // h2 heading (## )
    if (line.startsWith("## ")) {
      flushList();
      const content = line.substring(3);
      const level = Math.min(2 + headingOffset, 6);
      const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      elements.push(
        <HeadingTag key={index} className="text-xl font-bold mt-4 mb-2">
          {formatInlineMarkdown(content)}
        </HeadingTag>
      );
      return;
    }

    // Numbered list (1. )
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(
        <li key={index}>
          {formatInlineMarkdown(numberedMatch[2])}
        </li>
      );
      return;
    }

    // Bullet list (- )
    if (line.startsWith("- ")) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      const content = line.substring(2);
      listItems.push(
        <li key={index}>
          {formatInlineMarkdown(content)}
        </li>
      );
      return;
    }

    // Non-list line: flush any open list
    flushList();

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

  flushList();

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
