import type { Executor } from "@/lib/db/queries/define";
import { purgeRateLimits } from "@/lib/db/queries/rate-limit";
import { purgeDueContacts, purgeOldAuditIpHashes, purgeOldSubmissionIpHashes } from "@/lib/db/queries/retention";

/**
 * The daily clean-up that keeps the privacy promises in SPEC 12.3: reporters' contacts 30 days after
 * the decision, IP hashes and flood counters after 30 days. Called by the worker (worker/index.ts).
 */
export interface RetentionResult {
  contacts: number;
  submissionIpHashes: number;
  auditIpHashes: number;
  rateLimitRows: number;
}

export async function runRetention(exec: Executor, now: Date = new Date()): Promise<RetentionResult> {
  const before = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const contacts = await purgeDueContacts.build(exec, {});
  const submissionIpHashes = await purgeOldSubmissionIpHashes.build(exec, {});
  const [audit] = await purgeOldAuditIpHashes.build(exec, {});
  const rateLimitRows = await purgeRateLimits.build(exec, { before });
  return { contacts: contacts.length, submissionIpHashes: submissionIpHashes.length, auditIpHashes: Number(audit?.n ?? 0), rateLimitRows: rateLimitRows.length };
}
