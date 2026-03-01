import { timingSafeEqual } from "crypto";

export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const provided = Buffer.from(authHeader);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
