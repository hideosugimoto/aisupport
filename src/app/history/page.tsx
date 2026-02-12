import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import { HistoryList } from "@/components/HistoryList";
import Link from "next/link";

const repository = new PrismaTaskDecisionRepository(prisma);

export default async function HistoryPage() {
  const limit = 20;
  const page = 1;
  const offset = 0;

  const items = await repository.findAll(limit, offset);
  const total = await repository.count();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              判定履歴
            </h1>
            <div className="flex gap-4">
              <Link
                href="/compare"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                比較
              </Link>
              <Link
                href="/cost"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                コスト確認
              </Link>
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                タスク決定に戻る
              </Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            過去のAI判定結果を確認
          </p>
        </header>
        <HistoryList
          initialItems={items}
          initialTotal={total}
          initialPage={page}
          initialLimit={limit}
        />
      </div>
    </div>
  );
}
