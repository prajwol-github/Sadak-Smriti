import { and, desc, eq, sql } from "drizzle-orm";
import { feedItems, outlets, pipelineRuns } from "../schema";
import { defineQuery } from "./define";

/**
 * News collection (SPEC 7.2 steps 1–2; ADR 0007). The worker (worker/index.ts) writes; the review
 * area (/review) reads candidates and records decisions.
 */

const EXAMPLE_ID = "0199c8a0-0000-7000-8000-00000000000a";

// --- Outlets --------------------------------------------------------------------------------

export const upsertOutlet = defineQuery({
  name: "pipeline/upsert-outlet",
  description: "Adds or updates one outlet from content/outlets.json (`pnpm pipeline:outlets`). Health columns are kept.",
  example: { slug: "example-news", name: "Example News", language: "en" as const, feedUrl: "https://example.com/feed", enabled: true },
  build: (db, a: { slug: string; name: string; language: "ne" | "en"; feedUrl: string; enabled: boolean }) =>
    db.insert(outlets).values(a).onConflictDoUpdate({
      target: outlets.slug,
      set: { name: a.name, language: a.language, feedUrl: a.feedUrl, enabled: a.enabled, updatedAt: sql`now()` },
    }).returning({ id: outlets.id }),
});

export const enabledOutlets = defineQuery({
  name: "pipeline/enabled-outlets",
  description: "The outlets a collection run polls, in a fixed order.",
  example: {},
  build: (db) =>
    db.select({ id: outlets.id, slug: outlets.slug, feedUrl: outlets.feedUrl }).from(outlets).where(eq(outlets.enabled, true)).orderBy(outlets.slug),
});

export const outletSucceeded = defineQuery({
  name: "pipeline/outlet-succeeded",
  description: "An outlet's feed was read: clears its error count.",
  example: { outletId: EXAMPLE_ID },
  build: (db, a: { outletId: string }) =>
    db.update(outlets).set({ lastOkAt: sql`now()`, lastError: null, consecutiveFailures: 0, updatedAt: sql`now()` }).where(eq(outlets.id, a.outletId)),
});

export const outletFailed = defineQuery({
  name: "pipeline/outlet-failed",
  description: "An outlet's feed could not be read: keeps the error and counts failures in a row.",
  example: { outletId: EXAMPLE_ID, error: "HTTP 503" },
  build: (db, a: { outletId: string; error: string }) =>
    db.update(outlets).set({ lastError: a.error, consecutiveFailures: sql`${outlets.consecutiveFailures} + 1`, updatedAt: sql`now()` })
      .where(eq(outlets.id, a.outletId)).returning({ consecutiveFailures: outlets.consecutiveFailures }),
});

export const outletHealth = defineQuery({
  name: "pipeline/outlet-health",
  description: "Every outlet with its last success and error, for the review area.",
  example: {},
  build: (db) =>
    db.select({
      slug: outlets.slug, name: outlets.name, enabled: outlets.enabled, lastOkAt: outlets.lastOkAt,
      lastError: outlets.lastError, consecutiveFailures: outlets.consecutiveFailures,
    }).from(outlets).orderBy(outlets.name),
});

// --- Feed items -----------------------------------------------------------------------------

export const insertFeedItem = defineQuery({
  name: "pipeline/insert-feed-item",
  description: "Stores one feed entry unless its normalised URL was seen before. Returns a row only when it is new.",
  example: {
    outletId: EXAMPLE_ID, url: "https://example.com/news/1?utm_source=x", normalizedUrl: "https://example.com/news/1",
    title: "Example headline", summary: null, publishedAt: null, matched: true, matchedTerms: ["accident"],
  } as typeof feedItems.$inferInsert,
  build: (db, a: typeof feedItems.$inferInsert) =>
    db.insert(feedItems).values(a).onConflictDoNothing({ target: feedItems.normalizedUrl }).returning({ id: feedItems.id, matched: feedItems.matched }),
});

export const newCandidates = defineQuery({
  name: "pipeline/candidates",
  description: "One page of likely crash news waiting for a reviewer, newest first, with the total for the pager.",
  example: { limit: 20, offset: 0 },
  build: (db, a: { limit: number; offset: number }) =>
    db.select({
      id: feedItems.id, title: feedItems.title, url: feedItems.url, summary: feedItems.summary,
      publishedAt: feedItems.publishedAt, seenAt: feedItems.seenAt, matchedTerms: feedItems.matchedTerms,
      outlet: outlets.name, total: sql<number>`count(*) over ()`.mapWith(Number),
    })
      .from(feedItems)
      .innerJoin(outlets, eq(outlets.id, feedItems.outletId))
      .where(and(eq(feedItems.matched, true), eq(feedItems.status, "new")))
      .orderBy(desc(sql`coalesce(${feedItems.publishedAt}, ${feedItems.seenAt})`), desc(feedItems.id))
      .limit(a.limit).offset(a.offset),
});

export const decideFeedItem = defineQuery({
  name: "pipeline/decide-item",
  description: "A reviewer dismisses a candidate or marks it done. Only a candidate still waiting can change.",
  example: { id: EXAMPLE_ID, status: "dismissed" as const, userId: EXAMPLE_ID },
  build: (db, a: { id: string; status: "dismissed" | "done"; userId: string }) =>
    db.update(feedItems).set({ status: a.status, decidedBy: a.userId, decidedAt: sql`now()` })
      .where(and(eq(feedItems.id, a.id), eq(feedItems.status, "new"))).returning({ id: feedItems.id }),
});

// --- Runs -----------------------------------------------------------------------------------

export const requestRun = defineQuery({
  name: "pipeline/request-run",
  description:
    "Queues a collection run. Does nothing when one is already waiting or running (the partial unique\nindex pipeline_runs_one_active), so pressing \"Run now\" twice starts one run.",
  example: { trigger: "manual" as const, requestedBy: EXAMPLE_ID as string | null },
  build: (db, a: { trigger: "schedule" | "manual"; requestedBy: string | null }) =>
    db.insert(pipelineRuns).values(a).onConflictDoNothing().returning({ id: pipelineRuns.id }),
});

export const lastRunAt = defineQuery({
  name: "pipeline/last-run-at",
  description: "When the latest run was queued, to decide whether the 30-minute schedule is due.",
  example: {},
  build: (db) => db.select({ at: sql<string | null>`max(${pipelineRuns.createdAt})` }).from(pipelineRuns),
});

export const claimRun = defineQuery({
  name: "pipeline/claim-run",
  description: "The worker takes the oldest queued run and marks it running. `skip locked` keeps two workers from taking the same run.",
  example: {},
  build: (db) =>
    db.execute<{ id: string; trigger: "schedule" | "manual" }>(sql`
      update pipeline_runs set status = 'running', started_at = now(), updated_at = now()
      where id = (select id from pipeline_runs where status = 'queued' order by created_at limit 1 for update skip locked)
      returning id, trigger`),
});

export const finishRun = defineQuery({
  name: "pipeline/finish-run",
  description: "Records how a run ended, with its counts and each outlet's result.",
  example: {
    id: EXAMPLE_ID, status: "succeeded" as const, itemsSeen: 120, itemsNew: 14, candidatesNew: 3,
    outletResults: [{ slug: "example-news", ok: true, items: 20, new: 2 }] as unknown[], error: null as string | null,
  },
  build: (db, a: { id: string; status: "succeeded" | "failed"; itemsSeen: number; itemsNew: number; candidatesNew: number; outletResults: unknown[]; error: string | null }) =>
    db.update(pipelineRuns).set({
      status: a.status, finishedAt: sql`now()`, itemsSeen: a.itemsSeen, itemsNew: a.itemsNew, candidatesNew: a.candidatesNew,
      outletResults: a.outletResults, error: a.error, updatedAt: sql`now()`,
    }).where(eq(pipelineRuns.id, a.id)),
});

export const failStaleRuns = defineQuery({
  name: "pipeline/fail-stale-runs",
  description: "When the worker starts, a run still marked running from a crashed worker is closed as failed.",
  example: {},
  build: (db) =>
    db.update(pipelineRuns).set({ status: "failed", finishedAt: sql`now()`, error: "worker stopped during the run", updatedAt: sql`now()` })
      .where(eq(pipelineRuns.status, "running")).returning({ id: pipelineRuns.id }),
});

export const recentRuns = defineQuery({
  name: "pipeline/recent-runs",
  description: "The latest runs for the review area: when, how started, the outcome and the counts.",
  example: { limit: 10 },
  build: (db, a: { limit: number }) =>
    db.select({
      id: pipelineRuns.id, trigger: pipelineRuns.trigger, status: pipelineRuns.status, createdAt: pipelineRuns.createdAt,
      finishedAt: pipelineRuns.finishedAt, itemsNew: pipelineRuns.itemsNew, candidatesNew: pipelineRuns.candidatesNew, error: pipelineRuns.error,
    }).from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(a.limit),
});
