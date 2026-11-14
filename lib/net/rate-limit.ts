import type { Executor } from "@/lib/db/queries/define";
import { hitRateLimit } from "@/lib/db/queries/rate-limit";
import { todayInNepal } from "@/lib/domain/bs-date";

/**
 * Flood limits for crash reports from visitors (ADR 0004, SPEC 12.2). The numbers live here only;
 * SPEC 12.2 repeats them. A report counts when it is about to be saved, so fixing a typo and
 * submitting again doesn't use up the allowance.
 */
export const REPORT_LIMITS = {
  /** per device (IP hash) */
  perHour: 3,
  perDay: 10,
  /** all visitors together, per Nepal calendar day */
  sitePerDay: 300,
} as const;

export type LimitResult = { ok: true } | { ok: false; reason: "hour" | "day" | "site" };

/** Start of the UTC hour, and start of today in Nepal (00:00 at UTC+5:45). */
export function windows(now: Date): { hour: Date; day: Date } {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  const day = new Date(`${todayInNepal(now)}T00:00:00+05:45`);
  return { hour, day };
}

/**
 * Counts one report for this device and the site, and says whether it may be saved.
 * Pass the transaction that saves the report, so a refused or failed save isn't counted.
 */
export async function hitReportLimits(db: Executor, ipHash: string, now = new Date()): Promise<LimitResult> {
  const w = windows(now);
  const hit = async (key: string, windowStart: Date) => (await hitRateLimit.build(db, { key, windowStart }))[0].count;

  if ((await hit(`report:ip:hour:${ipHash}`, w.hour)) > REPORT_LIMITS.perHour) return { ok: false, reason: "hour" };
  if ((await hit(`report:ip:day:${ipHash}`, w.day)) > REPORT_LIMITS.perDay) return { ok: false, reason: "day" };
  if ((await hit("report:site:day", w.day)) > REPORT_LIMITS.sitePerDay) return { ok: false, reason: "site" };
  return { ok: true };
}

/**
 * Authenticator-code attempts per staff account (ADR 0006). Better Auth locks out wrong codes only
 * during a password sign-in, not for a code entered by someone already signed in with Google, so
 * this limit is what stops a stolen Google session from guessing the 6-digit code. Every attempt
 * counts, right or wrong.
 */
export const STAFF_CODE_LIMITS = { per15Min: 5, perDay: 20 } as const;

export async function hitStaffCodeLimit(db: Executor, userId: string, now = new Date()): Promise<{ ok: boolean }> {
  const quarter = new Date(now);
  quarter.setUTCMinutes(Math.floor(now.getUTCMinutes() / 15) * 15, 0, 0);
  const hit = async (key: string, windowStart: Date) => (await hitRateLimit.build(db, { key, windowStart }))[0].count;
  if ((await hit(`staff-code:15m:${userId}`, quarter)) > STAFF_CODE_LIMITS.per15Min) return { ok: false };
  if ((await hit(`staff-code:day:${userId}`, windows(now).day)) > STAFF_CODE_LIMITS.perDay) return { ok: false };
  return { ok: true };
}
