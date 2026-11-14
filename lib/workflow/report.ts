import { randomBytes } from "node:crypto";
import type { Executor } from "@/lib/db/queries/define";
import { locatePoint } from "@/lib/db/queries/places";
import {
  crashBySourceUrl, crashForAddition, districtForReport, insertAudit, insertCrashVehicles, insertDraftCrash, insertRevision,
  insertSource, insertSubmission, linkCrashSource, localUnitInDistrict, similarCrashes, sourceByUrl,
} from "@/lib/db/queries/reports";
import type { Report, ReportErrorKey } from "@/lib/forms/report";
import { encryptContact } from "@/lib/net/contact-crypto";
import { hitReportLimits } from "@/lib/net/rate-limit";

/**
 * Saving a visitor's crash report (docs/plans/report-a-crash.md step 8; SPEC 7.1, 7.3; ADR 0004).
 * Runs inside the caller's transaction, so the draft crash, its vehicles and source, the
 * submission, the revision and the audit row are written together or not at all.
 *
 * The caller has already checked the policy, the honeypot, the off switch and the captcha.
 */

export type Choice = { kind: "new"; confirmed: boolean } | { kind: "add"; crashId: string };

export type SimilarCrash = Awaited<ReturnType<typeof similarCrashes.build>>[number];

export type SaveResult =
  | { status: "saved"; submissionId: string; kind: "new_crash" | "add_source" }
  | { status: "duplicates"; crashes: SimilarCrash[] }
  | { status: "limited"; reason: "hour" | "day" | "site" }
  | { status: "invalid"; errors: Partial<Record<string, ReportErrorKey>> };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isNepali = (s: string) => /[ऀ-ॿ]/.test(s);

/**
 * Read-only: the crashes to ask "Is it one of these?" about, before the captcha is used.
 * Empty when the report's news link already belongs to a crash (saveReport routes it there).
 */
export async function findDuplicates(tx: Executor, r: Report): Promise<SimilarCrash[]> {
  if (r.source.kind === "news" && (await crashBySourceUrl.build(tx, { normalizedUrl: r.source.normalizedUrl })).length > 0) return [];
  return similarCrashes.build(tx, { districtId: r.districtId, from: addDays(r.occurredOn, -2), to: addDays(r.occurredOn, 2) });
}

export async function saveReport(
  tx: Executor,
  input: { report: Report; ipHash: string; choice: Choice; now?: Date },
): Promise<SaveResult> {
  const { report: r, ipHash, choice } = input;
  const flags = ["anonymous"];

  // 1. The place must be real. Nothing is counted against the limits yet.
  const [district] = await districtForReport.build(tx, { districtId: r.districtId });
  if (!district) return { status: "invalid", errors: { districtId: "district" } };
  if (r.localUnitId && (await localUnitInDistrict.build(tx, { localUnitId: r.localUnitId, districtId: r.districtId })).length === 0) {
    return { status: "invalid", errors: { localUnitId: "district" } };
  }
  if (r.location) {
    const [here] = await locatePoint.build(tx, { lon: r.location.lon, lat: r.location.lat });
    if (!here) return { status: "invalid", errors: { lat: "location" } }; // outside Nepal (SPEC 7.1)
    if (here.district_id !== r.districtId) flags.push("location_district_mismatch");
  }

  // 2. Which crash is this about? A known news link always means its crash.
  let targetCrashId: string | null = choice.kind === "add" ? choice.crashId : null;
  if (r.source.kind === "news" && !targetCrashId) {
    const [known] = await crashBySourceUrl.build(tx, { normalizedUrl: r.source.normalizedUrl });
    if (known) {
      targetCrashId = known.crashId;
      flags.push("duplicate_link");
    }
  }
  if (targetCrashId && (await crashForAddition.build(tx, { crashId: targetCrashId })).length === 0) {
    return { status: "invalid", errors: { form: "district" } };
  }

  // 3. Possible duplicates: ask before creating a new crash (SPEC 7.1).
  if (!targetCrashId) {
    const similar = await similarCrashes.build(tx, { districtId: r.districtId, from: addDays(r.occurredOn, -2), to: addDays(r.occurredOn, 2) });
    if (similar.length > 0) {
      if (choice.kind === "new" && !choice.confirmed) return { status: "duplicates", crashes: similar };
      flags.push("possible_duplicate");
    }
  }

  // 4. Flood limits, counted only now that the report is about to be saved.
  const limit = await hitReportLimits(tx, ipHash, input.now);
  if (!limit.ok) return { status: "limited", reason: limit.reason };

  // 5. Write.
  const needsTwo = r.source.kind !== "news"; // only source is the reporter (SPEC 7.4)
  if (needsTwo) flags.push("needs_two_approvals");
  const contactEncrypted = r.contact ? encryptContact(r.contact) : null;
  const payload = {
    occurredOn: r.occurredOn, occurredTime: r.occurredTime, districtId: r.districtId, localUnitId: r.localUnitId,
    placeName: r.placeName, killed: r.killed, injured: r.injured, vehicles: r.vehicles, location: r.location,
    source: r.source.kind === "news" ? { kind: "news", url: r.source.url } : { kind: "witness" },
  };

  // The source row (news links are reused if already known).
  let sourceId: string;
  if (r.source.kind === "news") {
    const [existing] = await sourceByUrl.build(tx, { normalizedUrl: r.source.normalizedUrl });
    sourceId = existing?.id ?? (await insertSource.build(tx, { kind: "news", url: r.source.url, normalizedUrl: r.source.normalizedUrl, textPrivate: null }))[0].id;
  } else {
    sourceId = (await insertSource.build(tx, { kind: "witness", url: null, normalizedUrl: null, textPrivate: r.source.text }))[0].id;
  }

  if (targetCrashId) {
    // A source or correction for an existing crash: stored only as a proposal (SPEC 7.3).
    const [sub] = await insertSubmission.build(tx, {
      kind: "add_source", targetType: "crash", targetId: targetCrashId, payload: { ...payload, sourceId },
      ipHash, requiredApprovals: needsTwo ? 2 : 1, flags, contactEncrypted,
    });
    await insertAudit.build(tx, { actorId: null, action: "submission.create", targetType: "submission", targetId: sub.id, after: { kind: "add_source", crashId: targetCrashId, flags }, ipHash });
    return { status: "saved", submissionId: sub.id, kind: "add_source" };
  }

  const [crash] = await insertDraftCrash.build(tx, {
    slug: `draft-${randomBytes(6).toString("hex")}`,
    occurredOn: r.occurredOn, occurredTime: r.occurredTime, provinceId: district.provinceId, districtId: r.districtId,
    localUnitId: r.localUnitId, placeName: r.placeName, placeNameIsNepali: r.placeName ? isNepali(r.placeName) : false,
    deaths: r.killed, injured: r.injured, location: r.location,
  });
  if (r.vehicles.length) await insertCrashVehicles.build(tx, { rows: r.vehicles.map((type) => ({ crashId: crash.id, type })) });
  await linkCrashSource.build(tx, { crashId: crash.id, sourceId });

  const [sub] = await insertSubmission.build(tx, {
    kind: "new_crash", targetType: "crash", targetId: crash.id, payload: { ...payload, sourceId },
    ipHash, requiredApprovals: needsTwo ? 2 : 1, flags, contactEncrypted,
  });
  await insertRevision.build(tx, { entityType: "crash", entityId: crash.id, version: 1, data: crash, submissionId: sub.id, actorId: null });
  await insertAudit.build(tx, { actorId: null, action: "submission.create", targetType: "submission", targetId: sub.id, after: { kind: "new_crash", crashId: crash.id, flags }, ipHash });
  return { status: "saved", submissionId: sub.id, kind: "new_crash" };
}
