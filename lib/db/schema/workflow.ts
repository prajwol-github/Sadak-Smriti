import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";

/** Submissions, history, audit and rate limits (SPEC 7.3, 10.5, 12.2; ADR 0004). */

export const submissionKind = pgEnum("submission_kind", [
  "new_crash", "edit_crash", "add_source", "remove_source", "new_person", "edit_person", "memorial_edit", "add_media",
  "add_link", "tribute", "tip", "merge_crashes", "merge_people", "split_crash", "split_person", "hide_name",
  "hide_memorial", "delete", "family_claim",
]);
export const submissionStatus = pgEnum("submission_status", ["pending", "approved", "rejected", "changes_requested", "withdrawn"]);
export const submissionVia = pgEnum("submission_via", ["web", "tip", "pipeline"]);

export const submissions = pgTable("submissions", {
  id: id(),
  kind: submissionKind("kind").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  payload: jsonb("payload").notNull(),
  via: submissionVia("via").notNull(),
  /** null = a visitor's report, a tip or the news pipeline. Users are anonymised, never deleted (SPEC 12.3). */
  submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "restrict" }),
  ipHash: text("ip_hash"),
  status: submissionStatus("status").notNull().default("pending"),
  requiredApprovals: smallint("required_approvals").notNull().default(1),
  flags: text("flags").array().notNull().default(sql`'{}'::text[]`),
  /** Reporter's optional contact, AES-256-GCM, key outside the database (SPEC 12.3). */
  contactEncrypted: text("contact_encrypted"),
  /** Set when a reviewer decides: decision time + 30 days. */
  contactPurgeAfter: timestamp("contact_purge_after", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("submissions_status_created_idx").on(t.status, t.createdAt),
  index("submissions_target_idx").on(t.targetType, t.targetId),
  check("submissions_required_approvals_range", sql`${t.requiredApprovals} between 1 and 2`),
]);

export const reviewDecision = pgEnum("review_decision", ["approve", "reject", "request_changes"]);
export const rejectionReason = pgEnum("rejection_reason", ["duplicate", "no_source", "wrong_info", "abuse", "graphic", "off_topic"]);

/** One reviewer's decision on a submission (SPEC 10.5). A reviewer decides a submission once. */
export const reviews = pgTable("reviews", {
  id: id(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "restrict" }),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  decision: reviewDecision("decision").notNull(),
  reasonCode: rejectionReason("reason_code"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("reviews_one_per_reviewer").on(t.submissionId, t.reviewerId),
  index("reviews_submission_idx").on(t.submissionId),
  check("reviews_reject_has_reason", sql`${t.decision} <> 'reject' or ${t.reasonCode} is not null`),
]);

/** Full history: one row per version of a crash, person, … (SPEC 10.5). */
export const revisions = pgTable("revisions", {
  id: id(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  version: integer("version").notNull(),
  data: jsonb("data").notNull(),
  /** Why a staff member made this change (required for staff edits, SPEC 4.2). */
  reason: text("reason"),
  submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "restrict" }),
  actorId: uuid("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("revisions_entity_idx").on(t.entityType, t.entityId, t.version)]);

/** Append-only: the app role may only INSERT (custom migration 0003). Never holds contact details. */
export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ipHash: text("ip_hash"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_log_target_idx").on(t.targetType, t.targetId)]);

/** Fixed-window counters for flood limits (lib/net/rate-limit.ts). Purged after 30 days. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.key, t.windowStart] })]);
