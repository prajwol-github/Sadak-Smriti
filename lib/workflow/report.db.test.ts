import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import type { Executor } from "@/lib/db/queries/define";
import { inRollback, testDb } from "@/lib/db/test-db";
import type { Report } from "@/lib/forms/report";
import { saveReport } from "./report";

/**
 * Saving a report end to end against the real database, as role `app`, rolled back each time.
 * Needs `pnpm db:up && pnpm db:migrate && pnpm db:places`.
 */
const { db, end } = testDb();
afterAll(() => end());

let kathmandu = "";
let lalitpur = "";
beforeAll(async () => {
  const rows = await db.execute<{ id: string; slug: string }>(q`select id, slug from districts where slug in ('kathmandu', 'lalitpur')`);
  kathmandu = rows.find((r) => r.slug === "kathmandu")!.id;
  lalitpur = rows.find((r) => r.slug === "lalitpur")!.id;
});

const NOW = new Date("2026-11-13T09:00:00Z");
const report = (over: Partial<Report> = {}): Report => ({
  occurredOn: "2026-11-12", occurredTime: null, districtId: kathmandu, localUnitId: null, placeName: "Example chowk",
  killed: 2, injured: 3, vehicles: ["bus", "motorcycle"], source: { kind: "witness", text: "I saw it happen." },
  contact: null, location: null, ...over,
});
const count = async (tx: Executor, table: string) =>
  (await tx.execute<{ n: number }>(q.raw(`select count(*)::int as n from ${table}`)))[0].n;

describe("saveReport", () => {
  it("writes a draft crash, its vehicles and source, a pending submission, a revision and an audit row", async () => {
    const out = await inRollback(db, async (tx) => {
      const before = { crashes: await count(tx, "crashes"), subs: await count(tx, "submissions") };
      const r = await saveReport(tx, { report: report(), ipHash: "dev-a", choice: { kind: "new", confirmed: false }, now: NOW });
      if (r.status !== "saved") return { r };
      const [sub] = await tx.execute<{ status: string; required_approvals: number; flags: string[]; target_id: string; contact_encrypted: string | null }>(
        q`select status, required_approvals, flags, target_id, contact_encrypted from submissions where id = ${r.submissionId}`);
      const [crash] = await tx.execute<{ status: string; deaths: number }>(q`select status, deaths from crashes where id = ${sub.target_id}`);
      const vehicles = await tx.execute(q`select type from crash_vehicles where crash_id = ${sub.target_id}`);
      const sources = await tx.execute<{ kind: string; text_private: string }>(q`select s.kind, s.text_private from sources s join crash_sources cs on cs.source_id = s.id where cs.crash_id = ${sub.target_id}`);
      const revisions = await tx.execute(q`select 1 from revisions where entity_id = ${sub.target_id}`);
      const audits = await tx.execute(q`select 1 from audit_log where target_id = ${r.submissionId}`);
      return {
        r, sub, crash, vehicles: vehicles.length, sources, revisions: revisions.length, audits: audits.length,
        added: { crashes: (await count(tx, "crashes")) - before.crashes, subs: (await count(tx, "submissions")) - before.subs },
      };
    });
    expect(out.r).toMatchObject({ status: "saved", kind: "new_crash" });
    expect(out).toMatchObject({
      sub: { status: "pending", required_approvals: 2, contact_encrypted: null },
      crash: { status: "draft", deaths: 2 },
      vehicles: 2, revisions: 1, audits: 1, added: { crashes: 1, subs: 1 },
      sources: [{ kind: "witness", text_private: "I saw it happen." }],
    });
    expect(out.sub!.flags).toEqual(expect.arrayContaining(["anonymous", "needs_two_approvals"]));
  });

  it("asks 'is it one of these?' when a crash exists nearby in time, then saves when the visitor says it's new", async () => {
    const out = await inRollback(db, async (tx) => {
      await saveReport(tx, { report: report(), ipHash: "dev-b", choice: { kind: "new", confirmed: false }, now: NOW });
      const second = await saveReport(tx, { report: report({ occurredOn: "2026-11-11" }), ipHash: "dev-c", choice: { kind: "new", confirmed: false }, now: NOW });
      const confirmed = await saveReport(tx, { report: report({ occurredOn: "2026-11-11" }), ipHash: "dev-c", choice: { kind: "new", confirmed: true }, now: NOW });
      return { second, confirmed };
    });
    expect(out.second.status).toBe("duplicates");
    expect(out.confirmed.status).toBe("saved");
  });

  it("turns a report into 'add a source' when the visitor picks an existing crash: no new crash", async () => {
    const out = await inRollback(db, async (tx) => {
      const first = await saveReport(tx, { report: report(), ipHash: "dev-d", choice: { kind: "new", confirmed: false }, now: NOW });
      if (first.status !== "saved") return { first };
      const [{ target_id: crashId }] = await tx.execute<{ target_id: string }>(q`select target_id from submissions where id = ${first.submissionId}`);
      const crashesBefore = await count(tx, "crashes");
      const add = await saveReport(tx, { report: report({ source: { kind: "news", url: "https://example.com/n/9", normalizedUrl: "example.com/n/9" } }), ipHash: "dev-e", choice: { kind: "add", crashId }, now: NOW });
      return { add, newCrashes: (await count(tx, "crashes")) - crashesBefore };
    });
    expect(out.add).toMatchObject({ status: "saved", kind: "add_source" });
    expect(out.newCrashes).toBe(0);
  });

  it("does not count a report that only showed the duplicate question", async () => {
    const out = await inRollback(db, async (tx) => {
      await saveReport(tx, { report: report(), ipHash: "dev-f", choice: { kind: "new", confirmed: false }, now: NOW });
      for (let i = 0; i < 5; i++) await saveReport(tx, { report: report(), ipHash: "dev-g", choice: { kind: "new", confirmed: false }, now: NOW });
      return (await tx.execute<{ n: number }>(q`select coalesce(sum(count), 0)::int as n from rate_limits where key like ${"%dev-g"}`))[0].n;
    });
    expect(out).toBe(0);
  });

  it("refuses the 4th saved report in an hour from one device", async () => {
    const last = await inRollback(db, async (tx) => {
      let r;
      for (let i = 0; i < 4; i++) r = await saveReport(tx, { report: report({ districtId: lalitpur, occurredOn: `2026-0${i + 1}-01` }), ipHash: "dev-h", choice: { kind: "new", confirmed: true }, now: NOW });
      return r;
    });
    expect(last).toEqual({ status: "limited", reason: "hour" });
  });

  it("refuses a location outside Nepal, and flags one outside the chosen district", async () => {
    const out = await inRollback(db, async (tx) => {
      const india = await saveReport(tx, { report: report({ location: { lat: 26.0, lon: 83.0 } }), ipHash: "dev-i", choice: { kind: "new", confirmed: true }, now: NOW });
      const pokhara = await saveReport(tx, { report: report({ location: { lat: 28.21, lon: 83.99 } }), ipHash: "dev-j", choice: { kind: "new", confirmed: true }, now: NOW });
      const flags = pokhara.status === "saved"
        ? (await tx.execute<{ flags: string[] }>(q`select flags from submissions where id = ${pokhara.submissionId}`))[0].flags : [];
      return { india, flags };
    });
    expect(out.india).toEqual({ status: "invalid", errors: { lat: "location" } });
    expect(out.flags).toContain("location_district_mismatch");
  });

  it("stores a contact only encrypted, never in the payload, revision or audit row", async () => {
    const out = await inRollback(db, async (tx) => {
      const r = await saveReport(tx, { report: report({ contact: "reporter@example.org" }), ipHash: "dev-k", choice: { kind: "new", confirmed: true }, now: NOW });
      if (r.status !== "saved") return { r };
      const hits = await tx.execute(q`
        select 1 from submissions where id = ${r.submissionId} and (payload::text like '%reporter@%' or contact_encrypted like '%reporter@%')
        union all select 1 from revisions where data::text like '%reporter@%'
        union all select 1 from audit_log where after::text like '%reporter@%'`);
      const [sub] = await tx.execute<{ contact_encrypted: string }>(q`select contact_encrypted from submissions where id = ${r.submissionId}`);
      return { r, plainHits: hits.length, encrypted: sub.contact_encrypted };
    });
    expect(out.plainHits).toBe(0);
    expect(out.encrypted).toMatch(/^v1\./);
  });
});
