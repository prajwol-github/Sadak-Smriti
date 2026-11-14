import { and, count, eq, sql } from "drizzle-orm";
import { crashSources, crashVehicles, crashes, persons, sources, submissions } from "../schema";
import { defineQuery } from "./define";

/**
 * Staff editing of crashes and the people in them (ADR 0008; PLAN P1-05, P3). Reads feed
 * /review/crashes; writes run in one transaction in lib/workflow/edit-crash.ts, each guarded by
 * the record's `version` so two people cannot silently overwrite each other.
 */

const EXAMPLE_ID = "0199c8a0-0000-7000-8000-00000000000a";

// --- Reads ----------------------------------------------------------------------------------

export const staffCrashList = defineQuery({
  name: "crash-edit/list",
  description: "One page of crashes for /review/crashes, newest first. `status` is all, published, draft (draft or pending) or rejected; merged crashes never show.",
  example: { status: "all" as "all" | "published" | "draft" | "rejected", limit: 25, offset: 0 },
  build: (db, a: { status: "all" | "published" | "draft" | "rejected"; limit: number; offset: number }) =>
    db.execute<{
      id: string; slug: string; status: string; occurredOn: string; deaths: number; titleEn: string | null; titleNp: string | null;
      placeNameEn: string | null; placeNameNp: string | null; districtEn: string; districtNp: string; persons: number; total: number;
    }>(sql`
      select c.id, c.slug, c.status, c.occurred_on::text as "occurredOn", c.deaths, c.title_en as "titleEn", c.title_np as "titleNp",
             c.place_name_en as "placeNameEn", c.place_name_np as "placeNameNp", d.name_en as "districtEn", d.name_np as "districtNp",
             (select count(*)::int from persons p where p.crash_id = c.id) as persons, count(*) over ()::int as total
      from crashes c join districts d on d.id = c.district_id
      where case ${a.status}::text
              when 'all' then c.status <> 'merged'
              when 'draft' then c.status in ('draft', 'pending')
              else c.status::text = ${a.status}::text
            end
      order by c.occurred_on desc, c.created_at desc, c.id desc
      limit ${a.limit} offset ${a.offset}`),
});

export const crashForEdit = defineQuery({
  name: "crash-edit/crash",
  description: "One crash with everything the editor shows: the editable facts, the place names, its vehicles and verification.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.execute<{
      id: string; slug: string; status: string; version: number; titleEn: string | null; titleNp: string | null;
      occurredOn: string; occurredTime: string | null; placeNameEn: string | null; placeNameNp: string | null;
      districtId: string; provinceId: string; districtEn: string; districtNp: string; provinceEn: string; provinceNp: string;
      deaths: number; injured: number | null; verification: string; createdVia: string; vehicles: string[] | null;
    }>(sql`
      select c.id, c.slug, c.status, c.version, c.title_en as "titleEn", c.title_np as "titleNp",
             c.occurred_on::text as "occurredOn", c.occurred_time::text as "occurredTime",
             c.place_name_en as "placeNameEn", c.place_name_np as "placeNameNp",
             c.district_id as "districtId", c.province_id as "provinceId", d.name_en as "districtEn", d.name_np as "districtNp",
             p.name_en as "provinceEn", p.name_np as "provinceNp", c.deaths, c.injured_total as injured,
             c.verification_level::text as verification, c.created_via::text as "createdVia",
             (select array_agg(v.type::text order by v.type) from crash_vehicles v where v.crash_id = c.id) as vehicles
      from crashes c join districts d on d.id = c.district_id join provinces p on p.id = c.province_id
      where c.id = ${a.id}`),
});

export const sourcesOfCrash = defineQuery({
  name: "crash-edit/sources",
  description: "A crash's sources for the editor: kind, link, how it relates, and when it was added. Witness statements are not included (private).",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.select({ id: sources.id, kind: sources.kind, url: sources.url, relation: crashSources.relation, addedAt: crashSources.createdAt })
      .from(crashSources).innerJoin(sources, eq(sources.id, crashSources.sourceId))
      .where(eq(crashSources.crashId, a.crashId)).orderBy(crashSources.createdAt),
});

export const personsOfCrash = defineQuery({
  name: "crash-edit/persons",
  description: "The people recorded for a crash, killed first then injured, in the order they were added.",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.select().from(persons).where(eq(persons.crashId, a.crashId))
      .orderBy(sql`case ${persons.status} when 'killed' then 0 when 'injured' then 1 else 2 end`, persons.createdAt, persons.id),
});

export const lockPerson = defineQuery({
  name: "crash-edit/lock-person",
  description: "Locks one person for the rest of the transaction.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) => db.select().from(persons).where(eq(persons.id, a.id)).for("update").limit(1),
});

export const lockCrash = defineQuery({
  name: "crash-edit/lock-crash",
  description: "Locks one crash for the rest of the transaction, so two edits at once are handled one after the other.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) => db.select().from(crashes).where(eq(crashes.id, a.id)).for("update").limit(1),
});

export const pendingSubmissionCount = defineQuery({
  name: "crash-edit/pending-submission-count",
  description:
    "How many submissions about a crash are still waiting for a decision. A crash with one cannot be published from the editor: the review queue decides it, with its two-reviewer rule (audit finding 4).",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.select({ n: count() }).from(submissions).where(and(eq(submissions.targetId, a.crashId), eq(submissions.status, "pending"))),
});

export const killedPersonCount = defineQuery({
  name: "crash-edit/killed-count",
  description: "How many people are recorded as killed in a crash, not counting one person (the one being edited).",
  example: { crashId: EXAMPLE_ID, exceptId: null as string | null },
  build: (db, a: { crashId: string; exceptId: string | null }) =>
    db.select({ n: count() }).from(persons)
      .where(and(eq(persons.crashId, a.crashId), eq(persons.status, "killed"), a.exceptId ? sql`${persons.id} <> ${a.exceptId}` : sql`true`)),
});

export const newsSourceCount = defineQuery({
  name: "crash-edit/news-source-count",
  description: "How many news sources a crash has (a person can be published as killed only when it has at least one).",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.select({ n: count() }).from(crashSources).innerJoin(sources, eq(sources.id, crashSources.sourceId))
      .where(and(eq(crashSources.crashId, a.crashId), eq(sources.kind, "news"))),
});

export const historyOfCrash = defineQuery({
  name: "crash-edit/history",
  description:
    "Every recorded version of a crash and of its people (also people since removed, found by the crash id kept in\ntheir snapshot), newest first, with who made the change and why.",
  example: { crashId: EXAMPLE_ID, limit: 100 },
  build: (db, a: { crashId: string; limit: number }) =>
    db.execute<{
      id: string; entityType: string; entityId: string; version: number; data: Record<string, unknown>; reason: string | null;
      createdAt: string; actorId: string | null; actorName: string | null; submissionId: string | null;
    }>(sql`
      select r.id, r.entity_type as "entityType", r.entity_id as "entityId", r.version, r.data, r.reason, r.created_at as "createdAt",
             r.actor_id as "actorId", u.name as "actorName", r.submission_id as "submissionId"
      from revisions r left join users u on u.id = r.actor_id
      where (r.entity_type = 'crash' and r.entity_id = ${a.crashId})
         or (r.entity_type = 'person' and (r.data->>'crashId') = ${a.crashId}::text)
      order by r.created_at desc, r.id desc
      limit ${a.limit}`),
});

export const revisionById = defineQuery({
  name: "crash-edit/revision",
  description: "One recorded version, to restore it.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.execute<{ id: string; entityType: string; entityId: string; version: number; data: Record<string, unknown> }>(
      sql`select id, entity_type as "entityType", entity_id as "entityId", version, data from revisions where id = ${a.id}`,
    ),
});

// --- Writes (inside the edit transaction) ---------------------------------------------------

type Facts = {
  id: string; version: number; titleEn: string | null; titleNp: string | null; occurredOn: string; occurredTime: string | null;
  placeNameEn: string | null; placeNameNp: string | null; districtId: string; provinceId: string; deaths: number; injured: number | null;
};

export const updateCrashFacts = defineQuery({
  name: "crash-edit/update-crash",
  description: "Saves the crash facts only if nobody changed it since the editor loaded it (the `version` must match). Raises the version.",
  example: {
    id: EXAMPLE_ID, version: 2, titleEn: "Bus fell off the road", titleNp: null, occurredOn: "2026-11-12", occurredTime: "05:45",
    placeNameEn: "Example bazaar", placeNameNp: null, districtId: EXAMPLE_ID, provinceId: EXAMPLE_ID, deaths: 3, injured: 5,
  } as Facts,
  build: (db, a: Facts) =>
    db.update(crashes).set({
      titleEn: a.titleEn, titleNp: a.titleNp, occurredOn: a.occurredOn, occurredTime: a.occurredTime, placeNameEn: a.placeNameEn,
      placeNameNp: a.placeNameNp, districtId: a.districtId, provinceId: a.provinceId, deaths: a.deaths, injuredTotal: a.injured,
      version: sql`${crashes.version} + 1`, updatedAt: sql`now()`,
    }).where(and(eq(crashes.id, a.id), eq(crashes.version, a.version))).returning(),
});

export const setCrashPublication = defineQuery({
  name: "crash-edit/set-status",
  description: "Publishes a crash (with its public slug) or takes it back to draft. Version-checked.",
  example: { id: EXAMPLE_ID, version: 2, status: "published" as "published" | "draft", slug: "2026-11-12-kathmandu-a1b2c3" as string | null },
  build: (db, a: { id: string; version: number; status: "published" | "draft"; slug: string | null }) =>
    db.update(crashes).set({
      status: a.status, ...(a.slug ? { slug: a.slug } : {}), version: sql`${crashes.version} + 1`, updatedAt: sql`now()`,
    }).where(and(eq(crashes.id, a.id), eq(crashes.version, a.version))).returning(),
});

export const deleteCrashVehicles = defineQuery({
  name: "crash-edit/delete-vehicles",
  description: "Clears a crash's vehicles before the edited list is written back.",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) => db.delete(crashVehicles).where(eq(crashVehicles.crashId, a.crashId)),
});

type PersonFields = {
  status: "killed" | "injured" | "uninjured"; nameEn: string | null; nameNp: string | null; age: number | null;
  sex: "female" | "male" | "other" | null; roadUser: "driver" | "passenger" | "pedestrian" | "rider" | "pillion" | "cyclist" | null;
  hometownText: string | null; nameVisibility: "public" | "hidden"; publication: "draft" | "published";
};
const EXAMPLE_PERSON: PersonFields = {
  status: "killed", nameEn: "Example Person", nameNp: null, age: 34, sex: "female", roadUser: "passenger",
  hometownText: "Example village", nameVisibility: "public", publication: "draft",
};

export const insertPerson = defineQuery({
  name: "crash-edit/insert-person",
  description: "Adds a person to a crash with an opaque slug (never made from the name). `id` is given only when a removed person is restored, so they keep their identity in the history.",
  example: { crashId: EXAMPLE_ID, slug: "p-1a2b3c4d", ...EXAMPLE_PERSON },
  build: (db, a: { id?: string; crashId: string; slug: string } & PersonFields) => db.insert(persons).values(a).returning(),
});

export const updatePerson = defineQuery({
  name: "crash-edit/update-person",
  description: "Saves a person's facts only if nobody changed them since the editor loaded them (the `version` must match). Raises the version.",
  example: { id: EXAMPLE_ID, version: 1, ...EXAMPLE_PERSON },
  build: (db, a: { id: string; version: number } & PersonFields) => {
    const { id, version, ...fields } = a;
    return db.update(persons).set({ ...fields, version: sql`${persons.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(persons.id, id), eq(persons.version, version))).returning();
  },
});

export const deletePerson = defineQuery({
  name: "crash-edit/delete-person",
  description: "Removes a person (admins only). The history keeps their last version, so nothing is lost.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) => db.delete(persons).where(eq(persons.id, a.id)).returning(),
});
