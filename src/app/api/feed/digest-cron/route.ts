import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { DigestService } from "@/lib/feed/digest-service";
import { ResendEmailService } from "@/lib/email/email-service";
import { createLogger } from "@/lib/logger";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { clerkClient } from "@clerk/nextjs/server";
import feedConfig from "@/../config/feed.json";

const logger = createLogger("cron:digest");

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Pro + active ユーザーを取得
    const proUsers = await prisma.subscription.findMany({
      where: { plan: "pro", status: "active" },
      select: { userId: true },
    });
    const proUserIds = proUsers.map((u) => u.userId);

    if (proUserIds.length === 0) {
      logger.info("No Pro users");
      return Response.json({ ok: true, sent: 0 });
    }

    // digestEnabled でフィルタ（設定未作成のユーザーはデフォルトtrue扱い）
    const allSettings = await prisma.notificationSetting.findMany({
      where: { userId: { in: proUserIds } },
      select: { userId: true, digestEnabled: true },
    });
    const settingsMap = new Map(
      allSettings.map((s) => [s.userId, s.digestEnabled])
    );

    const eligibleUserIds = proUserIds.filter((uid) => {
      const setting = settingsMap.get(uid);
      return setting === undefined || setting === true;
    });

    if (eligibleUserIds.length === 0) {
      logger.info("No eligible users for digest");
      return Response.json({ ok: true, sent: 0 });
    }

    // Clerk API でメール取得（並列化 + エラー耐性）
    const client = await clerkClient();
    const userEmails = new Map<string, string>();
    const concurrency = feedConfig.digest_cron_user_concurrency;

    for (let i = 0; i < eligibleUserIds.length; i += concurrency) {
      const batch = eligibleUserIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map((uid) => client.users.getUser(uid))
      );
      for (const [idx, r] of results.entries()) {
        if (r.status === "fulfilled") {
          const email = r.value.emailAddresses.find(
            (e) => e.id === r.value.primaryEmailAddressId
          )?.emailAddress;
          if (email) {
            userEmails.set(batch[idx], email);
          }
        } else {
          logger.warn("Failed to get user email", {
            userId: batch[idx],
            message: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    }

    // ダイジェスト送信（同時実行数制限付き）
    const fromEmail = process.env.DIGEST_FROM_EMAIL ?? feedConfig.digest_from_email;
    const fromName = process.env.DIGEST_FROM_NAME ?? feedConfig.digest_from_name;
    const emailService = new ResendEmailService(
      fromEmail,
      fromName,
      logger.child("email")
    );
    const digestService = new DigestService(
      emailService,
      logger.child("digest")
    );

    let sentCount = 0;
    let errorCount = 0;
    const userEntries = Array.from(userEmails.entries());

    for (let i = 0; i < userEntries.length; i += concurrency) {
      const batch = userEntries.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(([userId, email]) =>
          digestService.generateAndSendDigest(userId, email)
        )
      );

      for (const [idx, r] of results.entries()) {
        if (r.status === "fulfilled" && r.value.emailSent) {
          sentCount++;
        } else if (r.status === "fulfilled" && r.value.articlesCount === 0) {
          // 記事なし — エラーではない
        } else {
          errorCount++;
          logger.warn("Digest failed for user", {
            userId: batch[idx][0],
            reason:
              r.status === "rejected"
                ? r.reason instanceof Error
                  ? r.reason.message
                  : String(r.reason)
                : r.value.error ?? "unknown",
          });
        }
      }
    }

    logger.info("Digest cron completed", {
      eligible: eligibleUserIds.length,
      emailResolved: userEmails.size,
      sent: sentCount,
      errors: errorCount,
    });

    return Response.json({ ok: true, sent: sentCount, errors: errorCount });
  } catch (error) {
    logger.error("Digest cron error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
