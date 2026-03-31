import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import Link from "next/link";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const shared = await prisma.sharedResult.findUnique({ where: { id } });

  if (!shared || shared.expiresAt < new Date()) {
    return { title: "結果が見つかりません" };
  }

  const description = [...shared.content].slice(0, 120).join("").replace(/\n/g, " ");

  return {
    title: "AI意思決定アシスタントの判定結果",
    description,
    openGraph: {
      title: "AI意思決定アシスタントの判定結果",
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: "AI意思決定アシスタントの判定結果",
      description,
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { id } = await params;
  const shared = await prisma.sharedResult.findUnique({ where: { id } });

  if (!shared || shared.expiresAt < new Date()) {
    notFound();
  }

  const tasks: string[] = (() => {
    try {
      return JSON.parse(shared.tasks);
    } catch {
      return [];
    }
  })();

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-xl font-bold text-text mb-6">
          AI意思決定アシスタントの判定結果
        </h1>

        {tasks.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tasks.map((task) => (
              <span
                key={task}
                className="rounded-full bg-bg2 px-3 py-1 text-xs text-text2"
              >
                {task}
              </span>
            ))}
          </div>
        )}

        <div className="prose max-w-none rounded-lg border border-border-brand bg-surface p-6">
          <MarkdownContent text={shared.content} />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-text3">
          <span>{shared.provider} / {shared.model}</span>
          <span>{shared.createdAt.toLocaleDateString("ja-JP")}</span>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/sign-up"
            className="rounded-lg bg-root-bg px-6 py-3 text-sm font-medium text-root-color hover:bg-forest transition-colors"
          >
            無料で始める
          </Link>
        </div>
      </div>
    </div>
  );
}
