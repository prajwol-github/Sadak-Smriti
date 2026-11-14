import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import type { Executor } from "@/lib/db/queries/define";
import { users } from "@/lib/db/schema";
import { inRollback, pgError, testDb } from "@/lib/db/test-db";
import type { Report } from "@/lib/forms/report";
import type { Actor, Role } from "@/lib/policy/can";
import { decideSubmission } from "./decide";
import { saveReport } from "./report";

/**
 * The review decision against the real database, as role `app`, rolled back each time. Submissions
 * are created with the real saveReport path, as the website does. Reviewers are plain accounts in
 * the database (the website cannot create staff); the policy only needs the `Actor` we pass.
 * Needs `pnpm db:up && pnpm db:migrate && pnpm db:places`.
 */
const { db, end } = testDb();
afterAll(() => end());

let kathmandu = "";
beforeAll(async () => {
  const rows = await db.execute<{ id: string }>(q`select id from districts where slug = 'kathmandu'`);
  kathmandu = rows[0].id;
});

const NOW = new Date("2026-11-13T09:00:00Z");
const report = (over: Partial<Report> = {}): Report => ({
  occurredOn: "2026-11-12", occurredTime: null, districtId: kathmandu, localUnitId: null, placeName: "Example chowk",
  killed: 2, injured: 3, vehicles: ["bus"], source: { kind: "news", url: "https://example.com/news/1", normalizedUrl: "example.com/news/1" },
  contact: null, location: null, ...over,
});

let n = 0;
/** A real account (so reviews can point at it) and the Actor the policy sees. */
async function reviewer(tx: Executor, role: Role = "reviewer"): Promise<Actor> {
  n++;
  const [u] = await tx.insert(users).values({ name: `Example ${role} ${n}`, email: `decide-${role}-${n}@example.invalid` }).returning({ id: users.id });
  return { id: u.id, role, twoFactorEnabled: true, guardianOf: [] };
}
async function submit(tx: Executor, over: Partial<Report> = {}, ip = "dev-d") {
  const r = await saveReport(tx, { report: report(over), ipHash: ip, choice: { kind: "new", confirmed: true }, now: NOW });
  if (r.status !== "saved") throw new Error(`could not create the submission: ${r.status}`);
  const [s] = await tx.execute<{ target_id: string }>(q`select target_id from submissions where id = ${r.submissionId}`);
  return { id: r.submissionId, crashId: s.target_id };
}
const crashOf = async (tx: Executor, id: string) =>
  (await tx.execute<{ status: string; slug: string; version: number; verification_level: string }>(q`select status, slug, version, verification_level from crashes where id = ${id}`))[0];
const subStatus = async (tx: Executor, id: string) => (await tx.execute<{ status: string }>(q`select status from submissions where id = ${id}`))[0].status;

describe("approving", () => {
  it("one approval publishes a new crash with a real slug, a revision and an audit row", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const s = await submit(tx);
      const result = await decideSubmission(tx, who, s.id, { kind: "approve" });
      const revisions = await tx.execute<{ version: number }>(q`select version from revisions where entity_id = ${s.crashId} order by version`);
      const audit = await tx.execute<{ action: string }>(q`select action from audit_log where target_id = ${s.id} and actor_id = ${who.id}`);
      return { result, crash: await crashOf(tx, s.crashId), status: await subStatus(tx, s.id), revisions: revisions.map((r) => r.version), audit: audit.map((a) => a.action) };
    });
    expect(out.result).toEqual({ status: "published" });
    expect(out.crash.status).toBe("published");
    expect(out.crash.slug).toMatch(/^2026-11-12-kathmandu-[0-9a-f]{6}$/);
    expect(out.crash.version).toBe(2);
    expect(out.status).toBe("approved");
    expect(out.revisions).toEqual([1, 2]);
    expect(out.audit).toEqual(["submission.approve"]);
  });

  it("a witness-only report needs two different reviewers", async () => {
    const out = await inRollback(db, async (tx) => {
      const a = await reviewer(tx);
      const b = await reviewer(tx);
      const s = await submit(tx, { source: { kind: "witness", text: "I saw it." } });
      const first = await decideSubmission(tx, a, s.id, { kind: "approve" });
      const stillDraft = (await crashOf(tx, s.crashId)).status;
      const again = await decideSubmission(tx, a, s.id, { kind: "approve" });
      const second = await decideSubmission(tx, b, s.id, { kind: "approve" });
      return { first, stillDraft, again, second, final: (await crashOf(tx, s.crashId)).status };
    });
    expect(out.first).toEqual({ status: "waiting", approvals: 1, required: 2 });
    expect(out.stillDraft).toBe("draft");
    expect(out.again).toEqual({ status: "refused", reason: "already_decided" });
    expect(out.second).toEqual({ status: "published" });
    expect(out.final).toBe("published");
  });

  it("an addition to a published crash adds the source and raises the version", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const first = await submit(tx);
      await decideSubmission(tx, who, first.id, { kind: "approve" });
      const other = await reviewer(tx);
      const add = await saveReport(tx, {
        report: report({ source: { kind: "news", url: "https://example.com/news/2", normalizedUrl: "example.com/news/2" } }),
        ipHash: "dev-e", choice: { kind: "add", crashId: first.crashId }, now: NOW,
      });
      if (add.status !== "saved") throw new Error(add.status);
      const result = await decideSubmission(tx, other, add.submissionId, { kind: "approve" });
      const sources = (await tx.execute<{ n: number }>(q`select count(*)::int as n from crash_sources where crash_id = ${first.crashId}`))[0].n;
      return { result, sources, crash: await crashOf(tx, first.crashId) };
    });
    expect(out.result).toEqual({ status: "published" });
    expect(out.sources).toBe(2);
    expect(out.crash).toMatchObject({ status: "published", version: 3, verification_level: "multi_source" });
  });
});

describe("rejecting and asking for changes", () => {
  it("a rejection keeps the reason, marks the draft rejected and schedules the contact purge", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const s = await submit(tx, { contact: "someone@example.invalid" });
      const result = await decideSubmission(tx, who, s.id, { kind: "reject", reason: "no_source", note: "The link is dead" });
      const [review] = await tx.execute<{ decision: string; reason_code: string; note: string }>(q`select decision, reason_code, note from reviews where submission_id = ${s.id}`);
      const [purge] = await tx.execute<{ contact_purge_after: string | null }>(q`select contact_purge_after from submissions where id = ${s.id}`);
      return { result, review, crash: await crashOf(tx, s.crashId), status: await subStatus(tx, s.id), purge: purge.contact_purge_after };
    });
    expect(out.result).toEqual({ status: "rejected" });
    expect(out.review).toEqual({ decision: "reject", reason_code: "no_source", note: "The link is dead" });
    expect(out.crash.status).toBe("rejected");
    expect(out.status).toBe("rejected");
    expect(out.purge).not.toBeNull();
  });

  it("the database refuses a rejection with no reason", async () => {
    const code = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const s = await submit(tx);
      return pgError(tx.execute(q`insert into reviews (submission_id, reviewer_id, decision) values (${s.id}, ${who.id}, 'reject')`));
    });
    expect(code).toBe("23514"); // check_violation
  });

  it("asking for changes closes it without touching the crash", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const s = await submit(tx);
      const result = await decideSubmission(tx, who, s.id, { kind: "request_changes", note: "Which district exactly?" });
      return { result, crash: await crashOf(tx, s.crashId), status: await subStatus(tx, s.id) };
    });
    expect(out.result).toEqual({ status: "changes_requested" });
    expect(out.crash.status).toBe("draft");
    expect(out.status).toBe("changes_requested");
  });
});

describe("who may decide", () => {
  it("a contributor, and a reviewer whose code check has lapsed, are refused and nothing changes", async () => {
    const out = await inRollback(db, async (tx) => {
      const contributor = await reviewer(tx, "contributor");
      const lapsed = { ...(await reviewer(tx)), twoFactorEnabled: false };
      const s = await submit(tx);
      const results = [await decideSubmission(tx, contributor, s.id, { kind: "approve" }), await decideSubmission(tx, lapsed, s.id, { kind: "approve" })];
      const reviews = (await tx.execute<{ n: number }>(q`select count(*)::int as n from reviews where submission_id = ${s.id}`))[0].n;
      return { results, reviews, crash: (await crashOf(tx, s.crashId)).status };
    });
    expect(out.results).toEqual([{ status: "refused", reason: "not_permitted" }, { status: "refused", reason: "not_permitted" }]);
    expect(out.reviews).toBe(0);
    expect(out.crash).toBe("draft");
  });

  it("a decided submission cannot be decided again", async () => {
    const out = await inRollback(db, async (tx) => {
      const a = await reviewer(tx);
      const b = await reviewer(tx);
      const s = await submit(tx);
      await decideSubmission(tx, a, s.id, { kind: "reject", reason: "duplicate" });
      return decideSubmission(tx, b, s.id, { kind: "approve" });
    });
    expect(out).toEqual({ status: "refused", reason: "closed" });
  });

  it("an unknown submission is not found", async () => {
    const out = await inRollback(db, async (tx) => decideSubmission(tx, await reviewer(tx), "00000000-0000-7000-8000-000000000000", { kind: "approve" }));
    expect(out).toEqual({ status: "refused", reason: "not_found" });
  });

  it("the website cannot change or remove a recorded review", async () => {
    // One transaction each: a refused statement aborts its transaction in Postgres.
    const attempt = (statement: ReturnType<typeof q>) =>
      inRollback(db, async (tx) => {
        const who = await reviewer(tx);
        const s = await submit(tx);
        await decideSubmission(tx, who, s.id, { kind: "request_changes", note: "x" });
        return pgError(tx.execute(statement));
      });
    expect(await attempt(q`update reviews set note = 'edited'`)).toBe("42501");
    expect(await attempt(q`delete from reviews`)).toBe("42501");
  });
});

describe("a rejected report does not block its news link (audit finding 3)", () => {
  it("the same link can be reported again after the first report was rejected", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const first = await submit(tx);
      const rejected = await decideSubmission(tx, who, first.id, { kind: "reject", reason: "wrong_info", note: "Details do not match the article" });
      const again = await saveReport(tx, { report: report(), ipHash: "dev-e", choice: { kind: "new", confirmed: true }, now: NOW });
      return { rejected, again, crash: again.status === "saved" ? undefined : null };
    });
    expect(out.rejected).toEqual({ status: "rejected" });
    expect(out.again).toMatchObject({ status: "saved", kind: "new_crash" });
  });

  it("a link on a live crash still routes a new report to that crash", async () => {
    const out = await inRollback(db, async (tx) => {
      const who = await reviewer(tx);
      const first = await submit(tx);
      await decideSubmission(tx, who, first.id, { kind: "approve" });
      return saveReport(tx, { report: report(), ipHash: "dev-f", choice: { kind: "new", confirmed: true }, now: NOW });
    });
    expect(out).toMatchObject({ status: "saved", kind: "add_source" });
  });
});
