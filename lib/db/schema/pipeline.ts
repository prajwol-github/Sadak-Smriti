import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";

/**
 * News collection (SPEC 7.2 steps 1–2, 10.6; ADR 0007). The worker polls each outlet's feed,
 * keeps the items that look like crash news, and leaves them in the review area. Extraction
 * into draft crashes (steps 3–6) comes later.
 */

export const outletLanguage = pgEnum("outlet_language", ["ne", "en"]);
export const feedItemStatus = pgEnum("feed_item_status", ["new", "dismissed", "done"]);
export const pipelineTrigger = pgEnum("pipeline_trigger", ["schedule", "manual"]);
export const pipelineRunStatus = pgEnum("pipeline_run_status", ["queued", "running", "succeeded", "failed"]);

/** One news outlet's feed. Synced from content/outlets.json by `pnpm pipeline:outlets`. */
export const outlets = pgTable("outlets", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  language: outletLanguage("language").notNull(),
  feedUrl: text("feed_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  lastError: text("last_error"),
  /** Reset on success. An admin is told after 3 in a row (SPEC 7.2). */
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  ...timestamps,
});

/**
 * Every feed entry seen, crash news or not, so a second run adds nothing (the normalised URL is
 * unique). `matched` items are the candidates shown to reviewers.
 */
export const feedItems = pgTable("feed_items", {
  id: id(),
  outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "restrict" }),
  url: text("url").notNull(),
  normalizedUrl: text("normalized_url").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  matched: boolean("matched").notNull(),
  /** The keywords that made it a candidate, shown to the reviewer. */
  matchedTerms: text("matched_terms").array().notNull().default(sql`'{}'::text[]`),
  status: feedItemStatus("status").notNull().default("new"),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("feed_items_normalized_url_key").on(t.normalizedUrl),
  index("feed_items_queue_idx").on(t.matched, t.status, t.seenAt),
]);

/**
 * One collection run, scheduled or asked for with "Run now". The worker claims queued runs one at
 * a time (`for update skip locked`), so a run never happens twice at once.
 */
export const pipelineRuns = pgTable("pipeline_runs", {
  id: id(),
  trigger: pipelineTrigger("trigger").notNull(),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  status: pipelineRunStatus("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsSeen: integer("items_seen").notNull().default(0),
  itemsNew: integer("items_new").notNull().default(0),
  candidatesNew: integer("candidates_new").notNull().default(0),
  /** Per outlet: { slug, ok, items, new, error? }. */
  outletResults: jsonb("outlet_results").notNull().default(sql`'[]'::jsonb`),
  error: text("error"),
  ...timestamps,
}, (t) => [
  index("pipeline_runs_status_idx").on(t.status, t.createdAt),
  // At most one run waiting or running at a time; "Run now" while one is queued does nothing.
  uniqueIndex("pipeline_runs_one_active").on(sql`(true)`).where(sql`${t.status} in ('queued', 'running')`),
  check("pipeline_runs_counts", sql`${t.itemsSeen} >= 0 and ${t.itemsNew} >= 0 and ${t.candidatesNew} >= 0`),
]);
