"use client";

interface MarkdownContentProps {
  text: string;
  headingOffset?: number;
}

export function MarkdownContent({ text, headingOffset = 0 }: MarkdownContentProps) {
  const lines = text.split("\n");
  const elements: React.JSX.Element[] = [];

  lines.forEach((line, index) => {
    // h3 heading (### )
    if (line.startsWith("### ")) {
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
