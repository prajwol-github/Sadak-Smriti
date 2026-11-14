import { and, isNotNull, lt, sql } from "drizzle-orm";
import { submissions } from "../schema";
import { defineQuery } from "./define";

/**
 * Data we promise to delete (SPEC 12.3; audit finding 5). The worker runs these once a day
 * (lib/maintenance/retention.ts). Counters in `rate_limits` are purged by maintenance/purge-rate-limits.
 */

export const purgeDueContacts = defineQuery({
  name: "retention/purge-due-contacts",
  description: "Deletes the encrypted contact of every submission whose decision was more than 30 days ago.",
  example: {},
  build: (db) =>
    db.update(submissions).set({ contactEncrypted: null, contactPurgeAfter: null })
      .where(and(isNotNull(submissions.contactEncrypted), lt(submissions.contactPurgeAfter, sql`now()`)))
      .returning({ id: submissions.id }),
});

export const purgeOldSubmissionIpHashes = defineQuery({
  name: "retention/purge-submission-ip-hashes",
  description: "Blanks the visitor IP hash on submissions older than 30 days.",
  example: {},
  build: (db) =>
    db.update(submissions).set({ ipHash: null })
      .where(and(isNotNull(submissions.ipHash), lt(submissions.createdAt, sql`now() - interval '30 days'`)))
      .returning({ id: submissions.id }),
});

export const purgeOldAuditIpHashes = defineQuery({
  name: "retention/purge-audit-ip-hashes",
  description:
    "Blanks the IP hash on audit rows older than 30 days. The website cannot update audit_log, so this calls\npurge_old_audit_ip_hashes (migration 0010), which touches only that column.",
  example: {},
  build: (db) => db.execute<{ n: number }>(sql`select purge_old_audit_ip_hashes() as n`),
});
