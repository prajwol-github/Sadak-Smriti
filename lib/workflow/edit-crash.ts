import { randomBytes } from "node:crypto";
import type { Executor } from "@/lib/db/queries/define";
import {
  deleteCrashVehicles, crashForEdit, deletePerson, insertPerson, killedPersonCount, lockCrash, lockPerson, newsSourceCount, pendingSubmissionCount, revisionById,
  setCrashPublication, updateCrashFacts, updatePerson,
} from "@/lib/db/queries/crash-edit";
import { crashBySourceUrl, districtForReport, insertAudit, insertCrashVehicles, insertDraftCrash, insertRevision, insertSource, sourceByUrl } from "@/lib/db/queries/reports";
import { attachFollowUpSource, bumpCrashVersion, crashSourceCount, districtSlug } from "@/lib/db/queries/submissions";
import type { CrashFactsInput, NewsLinkInput, PersonInput } from "@/lib/forms/crash-edit";
import { effectiveNameVisibility } from "@/lib/forms/crash-edit";
import { can, type Actor } from "@/lib/policy/can";

/**
 * Staff changes to a crash and the people in it (ADR 0008). Each function runs inside the caller's
 * transaction and does, in this order: policy check, lock, version check, business rules, write,
 * history (a revision with the reason), audit row. A refused or failed change writes nothing.
 *
 * Staff publish directly; their changes are logged and can be restored from /review/crashes/[id]/history.
 */

export type EditResult =
  | { status: "saved"; personId?: string; crashId?: string }
  | { status: "conflict" }
  | { status: "invalid"; errors: Record<string, string> }
  | { status: "refused"; reason: "not_permitted" | "not_found" | "closed" | "unsupported" };

const refused = (reason: Extract<EditResult, { status: "refused" }>["reason"]): EditResult => ({ status: "refused", reason });
const invalid = (field: string, code: string): EditResult => ({ status: "invalid", errors: { [field]: code } });
const allowed = (actor: Actor, action: Parameters<typeof can>[1]) => can(actor, action).kind === "allow";

type CrashRow = NonNullable<Awaited<ReturnType<typeof lockCrash.build>>[number]>;
type PersonRow = NonNullable<Awaited<ReturnType<typeof lockPerson.build>>[number]>;

/** What the history keeps for a crash: the editable facts, status and vehicles. */
function crashSnapshot(c: Pick<CrashRow, "titleEn" | "titleNp" | "occurredOn" | "occurredTime" | "placeNameEn" | "placeNameNp" | "districtId" | "provinceId" | "deaths" | "injuredTotal" | "status" | "slug">, vehicles: string[]) {
  return {
    titleEn: c.titleEn, titleNp: c.titleNp, occurredOn: c.occurredOn, occurredTime: c.occurredTime, placeNameEn: c.placeNameEn, placeNameNp: c.placeNameNp,
    districtId: c.districtId, provinceId: c.provinceId, deaths: c.deaths, injured: c.injuredTotal, status: c.status, slug: c.slug, vehicles,
  };
}

/** What the history keeps for a person. `crashId` is how the history of a removed person is found. */
function personSnapshot(p: Pick<PersonRow, "crashId" | "slug" | "status" | "nameEn" | "nameNp" | "age" | "sex" | "roadUser" | "hometownText" | "nameVisibility" | "publication">) {
  return {
    crashId: p.crashId, slug: p.slug, status: p.status, nameEn: p.nameEn, nameNp: p.nameNp, age: p.age, sex: p.sex, roadUser: p.roadUser,
    hometownText: p.hometownText, nameVisibility: p.nameVisibility, publication: p.publication,
  };
}

const changedKeys = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(b).filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));

const EDITABLE = ["pending", "draft", "published"];

async function openCrash(tx: Executor, crashId: string): Promise<CrashRow | EditResult> {
  const [crash] = await lockCrash.build(tx, { id: crashId });
  if (!crash) return refused("not_found");
  if (!EDITABLE.includes(crash.status)) return refused("closed");
  return crash;
}
const isResult = (v: CrashRow | EditResult): v is EditResult => "status" in v && "id" in v === false;

async function vehiclesOf(tx: Executor, crashId: string): Promise<string[]> {
  const [row] = await crashForEdit.build(tx, { id: crashId });
  return row?.vehicles ?? [];
}

async function record(
  tx: Executor, actor: Actor, a: { entityType: "crash" | "person"; entityId: string; version: number; data: unknown; reason: string; action: string; crashId: string; after: Record<string, unknown> },
) {
  await insertRevision.build(tx, { entityType: a.entityType, entityId: a.entityId, version: a.version, data: a.data, submissionId: null, actorId: actor.id, reason: a.reason });
  await insertAudit.build(tx, { actorId: actor.id, action: a.action, targetType: a.entityType, targetId: a.entityId, after: { crashId: a.crashId, reason: a.reason, ...a.after }, ipHash: null });
}

// --- Crash facts ----------------------------------------------------------------------------

export async function saveCrashFacts(tx: Executor, actor: Actor, crashId: string, input: CrashFactsInput): Promise<EditResult> {
  if (!allowed(actor, "edit_crash")) return refused("not_permitted");
  const opened = await openCrash(tx, crashId);
  if (isResult(opened)) return opened;
  if (opened.version !== input.version) return { status: "conflict" };

  const [district] = await districtForReport.build(tx, { districtId: input.districtId });
  if (!district) return invalid("districtId", "invalid");
  const [{ n: killed }] = await killedPersonCount.build(tx, { crashId, exceptId: null });
  if (input.deaths < killed) return invalid("deaths", "belowPeople");

  const before = crashSnapshot(opened, await vehiclesOf(tx, crashId));
  const [updated] = await updateCrashFacts.build(tx, {
    id: crashId, version: input.version, titleEn: input.titleEn, titleNp: input.titleNp, occurredOn: input.occurredOn, occurredTime: input.occurredTime,
    placeNameEn: input.placeNameEn, placeNameNp: input.placeNameNp, districtId: input.districtId, provinceId: district.provinceId, deaths: input.deaths, injured: input.injured,
  });
  if (!updated) return { status: "conflict" };

  await deleteCrashVehicles.build(tx, { crashId });
  if (input.vehicles.length) await insertCrashVehicles.build(tx, { rows: input.vehicles.map((type) => ({ crashId, type })) });

  const after = crashSnapshot(updated, [...input.vehicles].sort());
  await record(tx, actor, {
    entityType: "crash", entityId: crashId, version: updated.version, data: after, reason: input.reason, action: "crash.edit", crashId,
    after: { changed: changedKeys(before, after) },
  });
  return { status: "saved" };
}

/** Publishes a draft crash (giving it its public slug) or takes a public one back to draft. */
export async function setCrashPublished(tx: Executor, actor: Actor, crashId: string, input: { version: number; reason: string; publish: boolean }): Promise<EditResult> {
  if (!allowed(actor, "edit_crash")) return refused("not_permitted");
  const opened = await openCrash(tx, crashId);
  if (isResult(opened)) return opened;
  if (opened.version !== input.version) return { status: "conflict" };
  const isPublic = opened.status === "published";
  if (input.publish === isPublic) return refused("closed");

  let slug: string | null = null;
  if (input.publish) {
    // A report still in the review queue is decided there (two reviewers for a witness-only report), not here.
    const [{ n: waiting }] = await pendingSubmissionCount.build(tx, { crashId });
    if (waiting > 0) return invalid("publish", "pendingReview");
    const [{ n: sources }] = await crashSourceCount.build(tx, { crashId });
    if (sources < 1) return invalid("publish", "noSource"); // every fact has a source (SPEC 3.2)
    if (opened.slug.startsWith("draft-")) {
      const [district] = await districtSlug.build(tx, { districtId: opened.districtId });
      slug = `${opened.occurredOn.slice(0, 10)}-${district?.slug ?? "nepal"}-${randomBytes(3).toString("hex")}`;
    }
  }
  const [updated] = await setCrashPublication.build(tx, { id: crashId, version: input.version, status: input.publish ? "published" : "draft", slug });
  if (!updated) return { status: "conflict" };
  await record(tx, actor, {
    entityType: "crash", entityId: crashId, version: updated.version, data: crashSnapshot(updated, await vehiclesOf(tx, crashId)), reason: input.reason,
    action: input.publish ? "crash.publish" : "crash.unpublish", crashId, after: { slug: updated.slug },
  });
  return { status: "saved" };
}

/** Adds a news link to a crash as a follow-up source. A link already on another crash is refused. */
export async function addNewsLink(tx: Executor, actor: Actor, crashId: string, input: NewsLinkInput): Promise<EditResult> {
  if (!allowed(actor, "add_news_link")) return refused("not_permitted");
  const opened = await openCrash(tx, crashId);
  if (isResult(opened)) return opened;

  const [known] = await crashBySourceUrl.build(tx, { normalizedUrl: input.normalizedUrl });
  if (known) return invalid("url", known.crashId === crashId ? "alreadyHere" : "linkedElsewhere");
  const [existing] = await sourceByUrl.build(tx, { normalizedUrl: input.normalizedUrl });
  const sourceId = existing?.id ?? (await insertSource.build(tx, { kind: "news", url: input.url, normalizedUrl: input.normalizedUrl, textPrivate: null }))[0].id;
  await attachFollowUpSource.build(tx, { crashId, sourceId });

  const [{ n }] = await crashSourceCount.build(tx, { crashId });
  const [updated] = await bumpCrashVersion.build(tx, { crashId, verification: n >= 2 ? "multi_source" : "single_source" });
  await record(tx, actor, {
    entityType: "crash", entityId: crashId, version: updated.version, data: crashSnapshot(updated, await vehiclesOf(tx, crashId)), reason: input.reason,
    action: "crash.add_source", crashId, after: { url: input.normalizedUrl },
  });
  return { status: "saved" };
}

// --- People ---------------------------------------------------------------------------------

/** The rules that depend on the crash. Returns an error result, or null when the person may be saved. */
async function personRuleError(tx: Executor, crash: CrashRow, fields: Pick<PersonInput, "status" | "publication">, exceptId: string | null): Promise<EditResult | null> {
  if (fields.status === "killed") {
    const [{ n }] = await killedPersonCount.build(tx, { crashId: crash.id, exceptId });
    if (n + 1 > crash.deaths) return invalid("status", "tooManyKilled"); // more named dead than the crash's death count
  }
  if (fields.status === "killed" && fields.publication === "published") {
    const [{ n }] = await newsSourceCount.build(tx, { crashId: crash.id });
    if (n < 1) return invalid("publication", "killedNeedsNewsSource"); // SPEC 7.4: never declare someone dead without a news source
  }
  return null;
}

export async function savePerson(tx: Executor, actor: Actor, crashId: string, personId: string | null, input: PersonInput): Promise<EditResult> {
  if (!allowed(actor, personId ? "edit_person" : "add_person")) return refused("not_permitted");
  const opened = await openCrash(tx, crashId);
  if (isResult(opened)) return opened;

  const fields = {
    status: input.status, nameEn: input.nameEn, nameNp: input.nameNp, age: input.age, sex: input.sex, roadUser: input.roadUser,
    hometownText: input.hometownText, nameVisibility: effectiveNameVisibility(input), publication: input.publication,
  };
  const rule = await personRuleError(tx, opened, fields, personId);
  if (rule) return rule;

  if (!personId) {
    const slug = `p-${randomBytes(4).toString("hex")}`;
    const [created] = await insertPerson.build(tx, { crashId, slug, ...fields });
    await record(tx, actor, { entityType: "person", entityId: created.id, version: created.version, data: personSnapshot(created), reason: input.reason, action: "person.add", crashId, after: { status: created.status } });
    return { status: "saved", personId: created.id };
  }

  const [current] = await lockPerson.build(tx, { id: personId });
  if (!current || current.crashId !== crashId) return refused("not_found");
  if (current.version !== input.version) return { status: "conflict" };
  const [updated] = await updatePerson.build(tx, { id: personId, version: current.version, ...fields });
  if (!updated) return { status: "conflict" };
  await record(tx, actor, {
    entityType: "person", entityId: personId, version: updated.version, data: personSnapshot(updated), reason: input.reason, action: "person.edit", crashId,
    after: { changed: changedKeys(personSnapshot(current), personSnapshot(updated)) },
  });
  return { status: "saved", personId };
}

/** Admins only (SPEC 4.2 "delete"). The history keeps the last version, so it can be restored. */
export async function removePerson(tx: Executor, actor: Actor, crashId: string, personId: string, reason: string): Promise<EditResult> {
  if (!allowed(actor, "delete")) return refused("not_permitted");
  const opened = await openCrash(tx, crashId);
  if (isResult(opened)) return opened;
  const [current] = await lockPerson.build(tx, { id: personId });
  if (!current || current.crashId !== crashId) return refused("not_found");
  await deletePerson.build(tx, { id: personId });
  await record(tx, actor, {
    entityType: "person", entityId: personId, version: current.version + 1, data: { ...personSnapshot(current), deleted: true }, reason, action: "person.delete", crashId, after: {},
  });
  return { status: "saved" };
}

// --- Restoring an earlier version -----------------------------------------------------------

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);

/**
 * Puts an earlier version back as a new version (history is never rewritten). A crash restores its
 * facts and vehicles, not its published/draft state. A person that was removed is added back with
 * the same address.
 */
export async function restoreVersion(tx: Executor, actor: Actor, crashId: string, revisionId: string, reason: string): Promise<EditResult> {
  if (!allowed(actor, "edit_crash")) return refused("not_permitted");
  const [rev] = await revisionById.build(tx, { id: revisionId });
  if (!rev) return refused("not_found");
  const s = rev.data as Record<string, unknown>;
  const why = `Restored version ${rev.version}: ${reason}`;

  if (rev.entityType === "crash") {
    if (rev.entityId !== crashId) return refused("not_found");
    const opened = await openCrash(tx, crashId);
    if (isResult(opened)) return opened;
    const occurredOn = str(s.occurredOn)?.slice(0, 10);
    const districtId = str(s.districtId);
    const deaths = num(s.deaths);
    if (!occurredOn || !districtId || deaths === null) return refused("unsupported");
    const [district] = await districtForReport.build(tx, { districtId });
    if (!district) return refused("unsupported");
    const [{ n: killed }] = await killedPersonCount.build(tx, { crashId, exceptId: null });
    if (deaths < killed) return invalid("deaths", "belowPeople");

    const before = crashSnapshot(opened, await vehiclesOf(tx, crashId));
    const [updated] = await updateCrashFacts.build(tx, {
      id: crashId, version: opened.version, titleEn: str(s.titleEn), titleNp: str(s.titleNp), occurredOn, occurredTime: str(s.occurredTime)?.slice(0, 5) ?? null,
      placeNameEn: str(s.placeNameEn), placeNameNp: str(s.placeNameNp), districtId, provinceId: district.provinceId, deaths, injured: num(s.injured) ?? num(s.injuredTotal),
    });
    if (!updated) return { status: "conflict" };
    const vehicles = Array.isArray(s.vehicles) ? (s.vehicles as string[]) : null;
    if (vehicles) {
      await deleteCrashVehicles.build(tx, { crashId });
      if (vehicles.length) await insertCrashVehicles.build(tx, { rows: vehicles.map((type) => ({ crashId, type: type as "bus" })) });
    }
    const after = crashSnapshot(updated, vehicles ?? before.vehicles);
    await record(tx, actor, { entityType: "crash", entityId: crashId, version: updated.version, data: after, reason: why, action: "history.restore", crashId, after: { restored: rev.version, changed: changedKeys(before, after) } });
    return { status: "saved" };
  }

  if (rev.entityType === "person") {
    if (s.crashId !== crashId || s.deleted === true) return refused("unsupported");
    const opened = await openCrash(tx, crashId);
    if (isResult(opened)) return opened;
    const fields = {
      status: str(s.status) as PersonRow["status"], nameEn: str(s.nameEn), nameNp: str(s.nameNp), age: num(s.age), sex: str(s.sex) as PersonRow["sex"],
      roadUser: str(s.roadUser) as PersonRow["roadUser"], hometownText: str(s.hometownText), nameVisibility: (str(s.nameVisibility) ?? "public") as PersonRow["nameVisibility"],
      publication: (str(s.publication) ?? "draft") as PersonRow["publication"],
    };
    if (!fields.status) return refused("unsupported");
    const rule = await personRuleError(tx, opened, fields, rev.entityId);
    if (rule) return rule;

    const [current] = await lockPerson.build(tx, { id: rev.entityId });
    if (current) {
      if (current.crashId !== crashId) return refused("not_found");
      const [updated] = await updatePerson.build(tx, { id: current.id, version: current.version, ...fields });
      if (!updated) return { status: "conflict" };
      await record(tx, actor, { entityType: "person", entityId: current.id, version: updated.version, data: personSnapshot(updated), reason: why, action: "history.restore", crashId, after: { restored: rev.version } });
      return { status: "saved", personId: current.id };
    }
    // Removed since: add them back, same id and address.
    if (!allowed(actor, "add_person") || !str(s.slug)) return refused("not_permitted");
    const [created] = await insertPerson.build(tx, { id: rev.entityId, crashId, slug: str(s.slug) as string, ...fields });
    await record(tx, actor, { entityType: "person", entityId: created.id, version: 1, data: personSnapshot(created), reason: why, action: "history.restore", crashId, after: { restored: rev.version, readded: true } });
    return { status: "saved", personId: created.id };
  }
  return refused("unsupported");
}

// --- Create a new crash (staff) -------------------------------------------------------------

export interface CreateCrashInput {
  reason: string;
  titleEn: string | null;
  titleNp: string | null;
  occurredOn: string;
  occurredTime: string | null;
  placeNameEn: string | null;
  placeNameNp: string | null;
  districtId: string;
  deaths: number;
  injured: number | null;
  vehicles: (typeof import("@/lib/forms/crash-edit").VEHICLE_TYPES)[number][];
}

/** Staff-direct crash creation (ADR 0008). Creates a draft, writes the first revision + audit. */
export async function createCrash(tx: Executor, actor: Actor, input: CreateCrashInput): Promise<EditResult> {
  if (!allowed(actor, "create_crash")) return refused("not_permitted");
  const [district] = await districtForReport.build(tx, { districtId: input.districtId });
  if (!district) return invalid("districtId", "invalid");

  const slug = `draft-${randomBytes(6).toString("hex")}`;
  const [crash] = await insertDraftCrash.build(tx, {
    slug, occurredOn: input.occurredOn, occurredTime: input.occurredTime,
    provinceId: district.provinceId, districtId: input.districtId, localUnitId: null,
    placeName: input.placeNameEn ?? input.placeNameNp ?? null,
    placeNameIsNepali: !input.placeNameEn && !!input.placeNameNp,
    deaths: input.deaths, injured: input.injured ?? 0, location: null,
  });

  // Persist both EN and NP titles separately — insertDraftCrash uses a single placeName field;
  // update the row immediately with the bilingual fields.
  if (input.titleEn || input.titleNp || (input.placeNameEn && input.placeNameNp)) {
    await updateCrashFacts.build(tx, {
      id: crash.id, version: crash.version,
      titleEn: input.titleEn, titleNp: input.titleNp,
      occurredOn: input.occurredOn, occurredTime: input.occurredTime,
      placeNameEn: input.placeNameEn, placeNameNp: input.placeNameNp,
      districtId: input.districtId, provinceId: district.provinceId,
      deaths: input.deaths, injured: input.injured,
    });
  }

  if (input.vehicles.length) {
    await insertCrashVehicles.build(tx, { rows: input.vehicles.map((type) => ({ crashId: crash.id, type })) });
  }

  const after = {
    titleEn: input.titleEn, titleNp: input.titleNp, occurredOn: input.occurredOn, occurredTime: input.occurredTime,
    placeNameEn: input.placeNameEn, placeNameNp: input.placeNameNp, districtId: input.districtId,
    provinceId: district.provinceId, deaths: input.deaths, injured: input.injured,
    status: "draft", slug, vehicles: [...input.vehicles].sort(),
  };
  await insertRevision.build(tx, { entityType: "crash", entityId: crash.id, version: crash.version, data: after, submissionId: null, actorId: actor.id, reason: input.reason });
  await insertAudit.build(tx, { actorId: actor.id, action: "crash.create", targetType: "crash", targetId: crash.id, after: { reason: input.reason }, ipHash: null });
  return { status: "saved", crashId: crash.id };
}
