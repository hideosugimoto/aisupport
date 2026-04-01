import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { PrismaTaskDecisionRepository } from "@/lib/db/prisma-task-decision-repository";
import { HistoryList } from "@/components/HistoryList";
import { SubNav } from "@/components/SubNav";
import featuresConfig from "../../../../config/features.json";

export const dynamic = "force-dynamic";

const repository = new PrismaTaskDecisionRepository(prisma);

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const limit = featuresConfig.history_page_limit;
  const page = 1;
  const offset = 0;

  const items = await repository.findAll(userId, limit, offset);
  const total = await repository.count(userId);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              判定履歴
            </h1>
            <SubNav links={[
              { href: "/compare", label: "比較" },
              { href: "/dashboard", label: "ホーム" },
            ]} />
          </div>
          <p className="mt-2 text-sm text-text2">
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
