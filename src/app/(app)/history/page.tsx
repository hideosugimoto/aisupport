import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import { HistoryList } from "@/components/HistoryList";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

const repository = new PrismaTaskDecisionRepository(prisma);

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const limit = 20;
  const page = 1;
  const offset = 0;

  const items = await repository.findAll(userId, limit, offset);
  const total = await repository.count(userId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              判定履歴
            </h1>
            <nav className="flex items-center gap-1">
              <Link
                href="/compare"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                比較
              </Link>
              <Link
                href="/cost"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                コスト確認
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              >
                タスク決定に戻る
              </Link>
              <UserButton />
            </nav>
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
