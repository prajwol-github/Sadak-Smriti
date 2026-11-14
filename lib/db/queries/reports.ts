import { and, between, eq, ne, notInArray, sql } from "drizzle-orm";
import { auditLog, crashSources, crashVehicles, crashes, districts, localUnits, revisions, sources, submissions } from "../schema";
import { defineQuery } from "./define";

/**
 * Everything the crash report form reads and writes (docs/plans/report-a-crash.md, steps 8–9).
 * Writes run inside one transaction in lib/workflow/report.ts.
 */

const EXAMPLE_ID = "0199c8a0-0000-7000-8000-00000000000a";

// --- Reads ----------------------------------------------------------------------------------

export const districtForReport = defineQuery({
  name: "reports/district",
  description: "The chosen district and its province, to check the form's district exists.",
  example: { districtId: EXAMPLE_ID },
  build: (db, a: { districtId: string }) =>
    db.select({ id: districts.id, provinceId: districts.provinceId, nameEn: districts.nameEn, nameNp: districts.nameNp })
      .from(districts).where(eq(districts.id, a.districtId)).limit(1),
});

export const localUnitInDistrict = defineQuery({
  name: "reports/local-unit-in-district",
  description: "Whether a local unit belongs to a district (the optional local-unit select).",
  example: { localUnitId: EXAMPLE_ID, districtId: EXAMPLE_ID },
  build: (db, a: { localUnitId: string; districtId: string }) =>
    db.select({ id: localUnits.id }).from(localUnits)
      .where(and(eq(localUnits.id, a.localUnitId), eq(localUnits.districtId, a.districtId))).limit(1),
});

export const similarCrashes = defineQuery({
  name: "crashes/similar",
  description:
    "Possible duplicates for the report form: crashes in the same district within ±2 days,\nincluding unreviewed drafts (SPEC 7.1), excluding rejected and merged ones. Newest first, at most 5.",
  example: { districtId: EXAMPLE_ID, from: "2026-11-10", to: "2026-11-14" },
  build: (db, a: { districtId: string; from: string; to: string }) =>
    db.select({
      id: crashes.id,
      slug: crashes.slug,
      status: crashes.status,
      occurredOn: crashes.occurredOn,
      titleEn: crashes.titleEn,
      titleNp: crashes.titleNp,
      placeNameEn: crashes.placeNameEn,
      placeNameNp: crashes.placeNameNp,
      deaths: crashes.deaths,
      injured: crashes.injuredTotal,
      sources: sql<number>`(select count(*)::int from ${crashSources} where ${crashSources.crashId} = ${crashes.id})`,
    })
      .from(crashes)
      .where(and(
        eq(crashes.districtId, a.districtId),
        between(crashes.occurredOn, a.from, a.to),
        notInArray(crashes.status, ["rejected", "merged"]),
      ))
      .orderBy(sql`${crashes.occurredOn} desc`, sql`${crashes.createdAt} desc`)
      .limit(5),
});

export const crashForAddition = defineQuery({
  name: "reports/crash-for-addition",
  description: "The crash a visitor chose in \"Is it one of these?\"; must exist and not be rejected or merged.",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.select({ id: crashes.id, slug: crashes.slug }).from(crashes)
      .where(and(eq(crashes.id, a.crashId), notInArray(crashes.status, ["rejected", "merged"]))).limit(1),
});

export const crashBySourceUrl = defineQuery({
  name: "reports/crash-by-source-url",
  description:
    "The live crash a news link is already attached to, if any (the same link never makes a second live crash).\nRejected crashes are ignored: otherwise one rejected report would block its link for everyone (audit finding 3).",
  example: { normalizedUrl: "example.com/news/1" },
  build: (db, a: { normalizedUrl: string }) =>
    db.select({ crashId: crashSources.crashId, sourceId: sources.id })
      .from(sources)
      .innerJoin(crashSources, eq(crashSources.sourceId, sources.id))
      .innerJoin(crashes, eq(crashes.id, crashSources.crashId))
      .where(and(eq(sources.normalizedUrl, a.normalizedUrl), ne(crashes.status, "rejected"))).limit(1),
});

export const sourceByUrl = defineQuery({
  name: "reports/source-by-url",
  description: "An existing source row for a news link (it may not be attached to a crash yet).",
  example: { normalizedUrl: "example.com/news/1" },
  build: (db, a: { normalizedUrl: string }) =>
    db.select({ id: sources.id }).from(sources).where(eq(sources.normalizedUrl, a.normalizedUrl)).limit(1),
});

export const pendingReports = defineQuery({
  name: "reports/pending",
  description:
    "Waiting reports for `pnpm db:pending`, oldest first, until the review queue exists (PLAN P1-07).\nShows whether a contact was given, never the contact itself.",
  example: { limit: 50 },
  build: (db, a: { limit: number }) =>
    db.execute<{
      id: string; kind: string; created_at: string; flags: string[]; required_approvals: number; has_contact: boolean;
      crash_id: string; crash_status: string; occurred_on: string; district: string; place: string | null;
      deaths: number; injured: number | null; vehicles: string | null; source_kind: string | null; source_url: string | null; witness: string | null;
    }>(sql`
      select s.id, s.kind, s.created_at, s.flags, s.required_approvals, (s.contact_encrypted is not null) as has_contact,
             c.id as crash_id, c.status as crash_status, c.occurred_on, d.name_en as district,
             coalesce(c.place_name_en, c.place_name_np) as place, c.deaths, c.injured_total as injured,
             (select string_agg(v.type::text, ', ') from crash_vehicles v where v.crash_id = c.id) as vehicles,
             src.kind as source_kind, src.url as source_url, src.text_private as witness
      from submissions s
      join crashes c on c.id = s.target_id
      join districts d on d.id = c.district_id
      left join sources src on src.id = (s.payload->>'sourceId')::uuid
      where s.status = 'pending'
      order by s.created_at
      limit ${a.limit}`),
});

// --- Writes ---------------------------------------------------------------------------------

type CrashInsert = {
  slug: string; occurredOn: string; occurredTime: string | null; provinceId: string; districtId: string;
  localUnitId: string | null; placeName: string | null; placeNameIsNepali: boolean;
  deaths: number; injured: number; location: { lat: number; lon: number } | null;
};

export const insertDraftCrash = defineQuery({
  name: "reports/insert-draft-crash",
  description: "A visitor's report becomes a draft crash: invisible to the public until a reviewer approves it (SPEC 7.3).",
  example: {
    slug: "draft-0a1b2c3d4e5f", occurredOn: "2026-11-12", occurredTime: "05:45", provinceId: EXAMPLE_ID, districtId: EXAMPLE_ID,
    localUnitId: null, placeName: "Example bazaar", placeNameIsNepali: false, deaths: 2, injured: 5, location: { lat: 27.7, lon: 85.3 },
  } as CrashInsert,
  build: (db, a: CrashInsert) =>
    db.insert(crashes).values({
      slug: a.slug,
      status: "draft",
      occurredOn: a.occurredOn,
      occurredTime: a.occurredTime,
      location: a.location ? sql`ST_SetSRID(ST_MakePoint(${a.location.lon}, ${a.location.lat}), 4326)::geography` : null,
      locationPrecision: a.location ? "exact" : a.localUnitId ? "local_unit" : a.placeName ? "place" : "district",
      placeNameEn: a.placeNameIsNepali ? null : a.placeName,
      placeNameNp: a.placeNameIsNepali ? a.placeName : null,
      provinceId: a.provinceId,
      districtId: a.districtId,
      localUnitId: a.localUnitId,
      deaths: a.deaths,
      injuredTotal: a.injured,
      createdVia: "contributor",
    }).returning(),
});

export const insertCrashVehicles = defineQuery({
  name: "reports/insert-vehicles",
  description: "The vehicle types a reporter picked.",
  example: { rows: [{ crashId: EXAMPLE_ID, type: "bus" as const }] },
  build: (db, a: { rows: (typeof crashVehicles.$inferInsert)[] }) => db.insert(crashVehicles).values(a.rows),
});

export const insertSource = defineQuery({
  name: "reports/insert-source",
  description: "A news link, or a witness statement kept private for reviewers (sources.text_private).",
  example: { kind: "news" as const, url: "https://example.com/news/1", normalizedUrl: "example.com/news/1", textPrivate: null },
  build: (db, a: { kind: "news" | "witness"; url: string | null; normalizedUrl: string | null; textPrivate: string | null }) =>
    db.insert(sources).values(a).returning({ id: sources.id }),
});

export const linkCrashSource = defineQuery({
  name: "reports/link-crash-source",
  description: "Attaches a source to a draft crash.",
  example: { crashId: EXAMPLE_ID, sourceId: EXAMPLE_ID },
  build: (db, a: { crashId: string; sourceId: string }) => db.insert(crashSources).values({ ...a, relation: "report" }),
});

export const insertSubmission = defineQuery({
  name: "reports/insert-submission",
  description: "The pending submission a reviewer will decide on (SPEC 7.3). Never holds the plain contact.",
  example: {
    kind: "new_crash" as const, targetType: "crash", targetId: EXAMPLE_ID, payload: { killed: 2 }, ipHash: "0f3a…",
    requiredApprovals: 2, flags: ["anonymous", "needs_two_approvals"], contactEncrypted: null,
  },
  build: (db, a: {
    kind: "new_crash" | "add_source"; targetType: string; targetId: string; payload: unknown; ipHash: string;
    requiredApprovals: number; flags: string[]; contactEncrypted: string | null;
  }) =>
    db.insert(submissions).values({ ...a, via: "web", submittedBy: null, status: "pending" }).returning({ id: submissions.id }),
});

export const insertRevision = defineQuery({
  name: "history/insert-revision",
  description: "One version of a record, for the full history (SPEC 10.5).",
  example: { entityType: "crash", entityId: EXAMPLE_ID, version: 1, data: { deaths: 2 }, submissionId: EXAMPLE_ID, actorId: null, reason: null as string | null },
  build: (db, a: { entityType: string; entityId: string; version: number; data: unknown; submissionId: string | null; actorId: string | null; reason?: string | null }) =>
    db.insert(revisions).values({ ...a, reason: a.reason ?? null }),
});

export const insertAudit = defineQuery({
  name: "history/insert-audit",
  description: "One audit-log row (append-only for the website, migration 0003). Never holds contact details.",
  example: { actorId: null, action: "submission.create", targetType: "submission", targetId: EXAMPLE_ID, after: { kind: "new_crash" }, ipHash: "0f3a…" },
  build: (db, a: { actorId: string | null; action: string; targetType: string; targetId: string; after: unknown; ipHash: string | null }) =>
    db.insert(auditLog).values(a),
});
