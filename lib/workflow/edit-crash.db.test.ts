import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import type { Executor } from "@/lib/db/queries/define";
import { inRollback, pgError, testDb } from "@/lib/db/test-db";
import type { CrashFactsInput, PersonInput } from "@/lib/forms/crash-edit";
import type { Actor, Role } from "@/lib/policy/can";
import type { Report } from "@/lib/forms/report";
import { addNewsLink, removePerson, restoreVersion, saveCrashFacts, savePerson, setCrashPublished } from "./edit-crash";
import { saveReport } from "./report";

/**
 * Staff editing against the real database, as role `app`, rolled back each time (ADR 0008). Crashes
 * are created with the real saveReport path. Needs `pnpm db:up && pnpm db:migrate && pnpm db:places`.
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
const actor = (role: Role): Actor => ({ id: `0199c8a0-0000-7000-8000-0000000000${role === "admin" ? "a1" : role === "reviewer" ? "b2" : "c3"}`, role, twoFactorEnabled: true, guardianOf: [] });
const admin = actor("admin");
const reviewer = actor("reviewer");
const contributor = actor("contributor");

async function newCrash(tx: Executor, over: Partial<Report> = {}) {
  const r = await saveReport(tx, {
    report: {
      occurredOn: "2026-11-12", occurredTime: null, districtId: kathmandu, localUnitId: null, placeName: "Example chowk", killed: 3, injured: 2, vehicles: ["bus"],
      source: { kind: "news", url: "https://example.com/news/1", normalizedUrl: "example.com/news/1" }, contact: null, location: null, ...over,
    },
    ipHash: "edit-a", choice: { kind: "new", confirmed: true }, now: NOW,
  });
  if (r.status !== "saved") throw new Error(r.status);
  const [s] = await tx.execute<{ target_id: string }>(q`select target_id from submissions where id = ${r.submissionId}`);
  return s.target_id;
}
/** The report that created the crash has been decided elsewhere; publishing from the editor is then allowed. */
const settle = (tx: Executor, id: string) => tx.execute(q`update submissions set status = 'withdrawn' where target_id = ${id}`);
const crashRow = async (tx: Executor, id: string) =>
  (await tx.execute<{ status: string; slug: string; version: number; deaths: number; injured_total: number | null; district_id: string; place_name_en: string | null; verification_level: string }>(
    q`select status, slug, version, deaths, injured_total, district_id, place_name_en, verification_level from crashes where id = ${id}`))[0];
const vehiclesOf = async (tx: Executor, id: string) => (await tx.execute<{ type: string }>(q`select type from crash_vehicles where crash_id = ${id} order by type`)).map((r) => r.type);
const revisions = async (tx: Executor, id: string) =>
  tx.execute<{ entity_type: string; version: number; reason: string; actor_id: string }>(q`select entity_type, version, reason, actor_id from revisions where entity_id = ${id} and reason is not null order by created_at, version`);

const facts = (version: number, over: Partial<CrashFactsInput> = {}): CrashFactsInput => ({
  version, reason: "Corrected from the police report", titleEn: "Bus fell off the road", titleNp: null, occurredOn: "2026-11-12", occurredTime: "05:45",
  placeNameEn: "Example bazaar", placeNameNp: null, districtId: kathmandu, deaths: 3, injured: 5, vehicles: ["bus", "truck"], ...over,
});
const person = (over: Partial<PersonInput> = {}): PersonInput => ({
  version: null, reason: "Named in the police statement", status: "killed", nameEn: "Example Person", nameNp: null, age: 34, sex: "female", roadUser: "passenger",
  hometownText: "Example village", nameVisibility: "public", publication: "draft", familyAskedToShow: false, ...over,
});

describe("saveCrashFacts", () => {
  it("changes the facts and vehicles, raises the version, and keeps a revision with the reason and who", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const before = await crashRow(tx, id);
      const result = await saveCrashFacts(tx, reviewer, id, facts(before.version, { placeNameEn: "Example bazaar", districtId: lalitpur, deaths: 4 }));
      const [audit] = await tx.execute<{ action: string; after: { changed: string[]; reason: string } }>(q`select action, after from audit_log where target_id = ${id} and action = 'crash.edit'`);
      return { result, before, after: await crashRow(tx, id), vehicles: await vehiclesOf(tx, id), revs: await revisions(tx, id), audit };
    });
    expect(out.result).toEqual({ status: "saved" });
    expect(out.after).toMatchObject({ version: out.before.version + 1, deaths: 4, injured_total: 5, district_id: lalitpur, place_name_en: "Example bazaar" });
    expect(out.vehicles).toEqual(["bus", "truck"]);
    expect(out.revs).toEqual([{ entity_type: "crash", version: out.before.version + 1, reason: "Corrected from the police report", actor_id: reviewer.id }]);
    expect(out.audit.after.changed).toEqual(expect.arrayContaining(["deaths", "districtId", "placeNameEn", "vehicles"]));
  });

  it("a stale version is a conflict and nothing changes", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const v = (await crashRow(tx, id)).version;
      await saveCrashFacts(tx, admin, id, facts(v));
      const stale = await saveCrashFacts(tx, reviewer, id, facts(v, { deaths: 9 }));
      return { stale, row: await crashRow(tx, id) };
    });
    expect(out.stale).toEqual({ status: "conflict" });
    expect(out.row.deaths).toBe(3);
  });

  it("a contributor is refused; a reviewer is allowed", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const v = (await crashRow(tx, id)).version;
      return [await saveCrashFacts(tx, contributor, id, facts(v)), await saveCrashFacts(tx, reviewer, id, facts(v))];
    });
    expect(out).toEqual([{ status: "refused", reason: "not_permitted" }, { status: "saved" }]);
  });

  it("the death count cannot drop below the people already recorded as killed", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await savePerson(tx, admin, id, null, person({ nameEn: "Example One" }));
      await savePerson(tx, admin, id, null, person({ nameEn: "Example Two" }));
      const v = (await crashRow(tx, id)).version;
      return saveCrashFacts(tx, admin, id, facts(v, { deaths: 1 }));
    });
    expect(out).toEqual({ status: "invalid", errors: { deaths: "belowPeople" } });
  });

  it("an unknown district is refused", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      return saveCrashFacts(tx, admin, id, facts((await crashRow(tx, id)).version, { districtId: "00000000-0000-7000-8000-000000000000" }));
    });
    expect(out).toEqual({ status: "invalid", errors: { districtId: "invalid" } });
  });

  it("a rejected crash cannot be edited", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const v = (await crashRow(tx, id)).version;
      await tx.execute(q`update crashes set status = 'rejected' where id = ${id}`);
      return saveCrashFacts(tx, admin, id, facts(v));
    });
    expect(out).toEqual({ status: "refused", reason: "closed" });
  });
});

describe("publishing and sources", () => {
  it("publishes a draft with a real slug, then takes it back to draft", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await settle(tx, id);
      let v = (await crashRow(tx, id)).version;
      const published = await setCrashPublished(tx, admin, id, { version: v, reason: "Checked the article", publish: true });
      const live = await crashRow(tx, id);
      v = live.version;
      const hidden = await setCrashPublished(tx, admin, id, { version: v, reason: "Family asked", publish: false });
      return { published, live, hidden, after: await crashRow(tx, id) };
    });
    expect(out.published).toEqual({ status: "saved" });
    expect(out.live.status).toBe("published");
    expect(out.live.slug).toMatch(/^2026-11-12-kathmandu-[0-9a-f]{6}$/);
    expect(out.hidden).toEqual({ status: "saved" });
    expect(out.after.status).toBe("draft");
    expect(out.after.slug).toBe(out.live.slug); // the address stays once it exists
  });

  it("a crash with no source cannot be published", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await settle(tx, id);
      await tx.execute(q`delete from crash_sources where crash_id = ${id}`);
      return setCrashPublished(tx, admin, id, { version: (await crashRow(tx, id)).version, reason: "Trying", publish: true });
    });
    expect(out).toEqual({ status: "invalid", errors: { publish: "noSource" } });
  });

  it("a draft still waiting in the review queue cannot be published from the editor, even by an admin (audit finding 4)", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx, { source: { kind: "witness", text: "I saw it." } }); // needs two reviewers in the queue
      const v = (await crashRow(tx, id)).version;
      const refused = await setCrashPublished(tx, reviewer, id, { version: v, reason: "Skipping the queue", publish: true });
      const stillDraft = (await crashRow(tx, id)).status;
      await settle(tx, id);
      return { refused, stillDraft };
    });
    expect(out.refused).toEqual({ status: "invalid", errors: { publish: "pendingReview" } });
    expect(out.stillDraft).toBe("draft");
  });

  it("adds a news link; the second source makes it multi-source; a known link is refused", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await newCrash(tx, { occurredOn: "2026-11-10", source: { kind: "news", url: "https://example.com/news/other", normalizedUrl: "example.com/news/other" } });
      const link = { url: "https://example.com/news/2", normalizedUrl: "example.com/news/2", reason: "Follow-up article" };
      const first = await addNewsLink(tx, reviewer, id, link);
      const again = await addNewsLink(tx, reviewer, id, link);
      const elsewhere = await addNewsLink(tx, reviewer, id, { ...link, url: "https://example.com/news/other", normalizedUrl: "example.com/news/other" });
      return { first, again, elsewhere, row: await crashRow(tx, id), revs: await revisions(tx, id) };
    });
    expect(out.first).toEqual({ status: "saved" });
    expect(out.again).toEqual({ status: "invalid", errors: { url: "alreadyHere" } });
    expect(out.elsewhere).toEqual({ status: "invalid", errors: { url: "linkedElsewhere" } });
    expect(out.row.verification_level).toBe("multi_source");
    expect(out.revs).toHaveLength(1);
  });
});

describe("people", () => {
  it("adds a person with an opaque address and a revision", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const r = await savePerson(tx, reviewer, id, null, person());
      const [p] = await tx.execute<{ slug: string; version: number; publication: string; name_visibility: string }>(q`select slug, version, publication, name_visibility from persons where crash_id = ${id}`);
      return { r, p, revs: (await tx.execute<{ entity_type: string }>(q`select entity_type from revisions where data->>'crashId' = ${id}`)).length };
    });
    expect(out.r.status).toBe("saved");
    expect(out.p.slug).toMatch(/^p-[0-9a-f]{8}$/);
    expect(out.p).toMatchObject({ version: 1, publication: "draft", name_visibility: "public" });
    expect(out.revs).toBe(1);
  });

  it("an injured child's name is hidden unless the family asked", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await savePerson(tx, admin, id, null, person({ status: "injured", age: 9, nameEn: "Example Child" }));
      await savePerson(tx, admin, id, null, person({ status: "injured", age: 9, nameEn: "Example Child Two", familyAskedToShow: true }));
      return (await tx.execute<{ name_en: string; name_visibility: string }>(q`select name_en, name_visibility from persons where crash_id = ${id} order by name_en`));
    });
    expect(out.map((r) => r.name_visibility)).toEqual(["hidden", "public"]);
  });

  it("no more people can be recorded as killed than the crash's death count", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx, { killed: 1 });
      const first = await savePerson(tx, admin, id, null, person({ nameEn: "Example One" }));
      const second = await savePerson(tx, admin, id, null, person({ nameEn: "Example Two" }));
      const injured = await savePerson(tx, admin, id, null, person({ nameEn: "Example Three", status: "injured" }));
      return { first, second, injured };
    });
    expect(out.first.status).toBe("saved");
    expect(out.second).toEqual({ status: "invalid", errors: { status: "tooManyKilled" } });
    expect(out.injured.status).toBe("saved");
  });

  it("someone is published as killed only when the crash has a news source", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      await tx.execute(q`delete from crash_sources where crash_id = ${id}`);
      const noSource = await savePerson(tx, admin, id, null, person({ publication: "published" }));
      const asDraft = await savePerson(tx, admin, id, null, person({ publication: "draft" }));
      return { noSource, asDraft };
    });
    expect(out.noSource).toEqual({ status: "invalid", errors: { publication: "killedNeedsNewsSource" } });
    expect(out.asDraft.status).toBe("saved");
  });

  it("an edit is version-checked and keeps who and why", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const added = await savePerson(tx, admin, id, null, person());
      const pid = (added as { personId: string }).personId;
      const ok = await savePerson(tx, reviewer, id, pid, person({ version: 1, age: 35, reason: "Age corrected from the family" }));
      const stale = await savePerson(tx, admin, id, pid, person({ version: 1, age: 40 }));
      const [p] = await tx.execute<{ age: number; version: number }>(q`select age, version from persons where id = ${pid}`);
      return { ok, stale, p, revs: await revisions(tx, pid) };
    });
    expect(out.ok.status).toBe("saved");
    expect(out.stale).toEqual({ status: "conflict" });
    expect(out.p).toEqual({ age: 35, version: 2 });
    expect(out.revs.at(-1)).toMatchObject({ reason: "Age corrected from the family", actor_id: reviewer.id, version: 2 });
  });

  it("a contributor cannot add or edit people", async () => {
    const out = await inRollback(db, async (tx) => savePerson(tx, contributor, await newCrash(tx), null, person()));
    expect(out).toEqual({ status: "refused", reason: "not_permitted" });
  });

  it("only an admin removes a person; the history keeps the last version", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const pid = ((await savePerson(tx, admin, id, null, person())) as { personId: string }).personId;
      const byReviewer = await removePerson(tx, reviewer, id, pid, "Entered twice");
      const byAdmin = await removePerson(tx, admin, id, pid, "Entered twice");
      const left = (await tx.execute(q`select 1 from persons where id = ${pid}`)).length;
      const [last] = await tx.execute<{ data: { deleted?: boolean; nameEn: string } }>(q`select data from revisions where entity_id = ${pid} order by created_at desc, version desc limit 1`);
      return { byReviewer, byAdmin, left, last };
    });
    expect(out.byReviewer).toEqual({ status: "refused", reason: "not_permitted" });
    expect(out.byAdmin).toEqual({ status: "saved" });
    expect(out.left).toBe(0);
    expect(out.last.data).toMatchObject({ deleted: true, nameEn: "Example Person" });
  });
});

describe("restoring an earlier version", () => {
  it("brings back the facts and vehicles as a new version, leaving history intact", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const v1 = (await crashRow(tx, id)).version;
      await saveCrashFacts(tx, admin, id, facts(v1, { deaths: 3, vehicles: ["bus"], placeNameEn: "First place" }));
      const [firstEdit] = await tx.execute<{ id: string }>(q`select id from revisions where entity_id = ${id} and reason is not null order by created_at limit 1`);
      await saveCrashFacts(tx, admin, id, facts(v1 + 1, { deaths: 5, vehicles: ["truck", "jeep"], placeNameEn: "Second place" }));
      const restored = await restoreVersion(tx, reviewer, id, firstEdit.id, "The second edit was wrong");
      return { restored, row: await crashRow(tx, id), vehicles: await vehiclesOf(tx, id), revs: await revisions(tx, id) };
    });
    expect(out.restored).toEqual({ status: "saved" });
    expect(out.row).toMatchObject({ deaths: 3, place_name_en: "First place" });
    expect(out.vehicles).toEqual(["bus"]);
    expect(out.revs).toHaveLength(3);
    expect(out.revs.at(-1)!.reason).toMatch(/^Restored version \d+: The second edit was wrong$/);
  });

  it("restores a person to an earlier version, and adds back a removed one with the same id and address", async () => {
    const out = await inRollback(db, async (tx) => {
      const id = await newCrash(tx);
      const pid = ((await savePerson(tx, admin, id, null, person({ age: 34 }))) as { personId: string }).personId;
      const [added] = await tx.execute<{ id: string }>(q`select id from revisions where entity_id = ${pid} order by created_at limit 1`);
      await savePerson(tx, admin, id, pid, person({ version: 1, age: 99 }));
      const back = await restoreVersion(tx, admin, id, added.id, "Age was right");
      const [p] = await tx.execute<{ age: number; slug: string }>(q`select age, slug from persons where id = ${pid}`);
      await removePerson(tx, admin, id, pid, "Entered twice");
      const readded = await restoreVersion(tx, admin, id, added.id, "Removed by mistake");
      const [again] = await tx.execute<{ id: string; slug: string; age: number }>(q`select id, slug, age from persons where crash_id = ${id}`);
      return { back, p, readded, again, pid };
    });
    expect(out.back).toEqual({ status: "saved", personId: out.pid });
    expect(out.p.age).toBe(34);
    expect(out.readded).toMatchObject({ status: "saved" });
    expect(out.again).toMatchObject({ id: out.pid, slug: out.p.slug, age: 34 });
  });

  it("refuses a version that belongs to another crash, and a contributor", async () => {
    const out = await inRollback(db, async (tx) => {
      const a = await newCrash(tx);
      const b = await newCrash(tx, { occurredOn: "2026-11-09", source: { kind: "news", url: "https://example.com/news/b", normalizedUrl: "example.com/news/b" } });
      await saveCrashFacts(tx, admin, a, facts((await crashRow(tx, a)).version));
      const [rev] = await tx.execute<{ id: string }>(q`select id from revisions where entity_id = ${a} and reason is not null limit 1`);
      return [await restoreVersion(tx, admin, b, rev.id, "Wrong crash"), await restoreVersion(tx, contributor, a, rev.id, "Not allowed")];
    });
    expect(out).toEqual([{ status: "refused", reason: "not_found" }, { status: "refused", reason: "not_permitted" }]);
  });
});

describe("the history cannot be rewritten by the website", () => {
  it("refuses to change or remove a revision", async () => {
    const attempt = (statement: ReturnType<typeof q>) =>
      inRollback(db, async (tx) => {
        const id = await newCrash(tx);
        await saveCrashFacts(tx, admin, id, facts((await crashRow(tx, id)).version));
        return pgError(tx.execute(statement));
      });
    expect(await attempt(q`update revisions set reason = 'edited'`)).toBe("42501");
    expect(await attempt(q`delete from revisions`)).toBe("42501");
  });
});
