import { and, count, eq, inArray, sql } from "drizzle-orm";
import { crashSources, crashes, districts, reviews, submissions } from "../schema";
import { defineQuery } from "./define";

/**
 * The review queue and decisions (SPEC 7.3, 7.4; PLAN P1-07). Reads feed /review/submissions;
 * writes run in one transaction in lib/workflow/decide.ts.
 */

const EXAMPLE_ID = "0199c8a0-0000-7000-8000-00000000000a";

// --- Reads ----------------------------------------------------------------------------------

export const pendingSubmissions = defineQuery({
  name: "submissions/pending",
  description:
    "One page of submissions waiting for a decision, for /review/submissions. Crashes with 3 or more\ndeaths come first, then oldest first (SPEC 7.4). Includes how many approvals each has so far.",
  example: { limit: 25, offset: 0 },
  build: (db, a: { limit: number; offset: number }) =>
    db.execute<{
      id: string; kind: string; via: string; flags: string[]; requiredApprovals: number; approvals: number; createdAt: string;
      crashId: string; occurredOn: string; deaths: number; placeNameEn: string | null; placeNameNp: string | null;
      districtEn: string; districtNp: string; total: number;
    }>(sql`
      select s.id, s.kind, s.via, s.flags, s.required_approvals as "requiredApprovals",
             (select count(*)::int from reviews r where r.submission_id = s.id and r.decision = 'approve') as approvals,
             s.created_at as "createdAt", c.id as "crashId", c.occurred_on::text as "occurredOn", c.deaths,
             c.place_name_en as "placeNameEn", c.place_name_np as "placeNameNp",
             d.name_en as "districtEn", d.name_np as "districtNp", count(*) over ()::int as total
      from submissions s
      join crashes c on c.id = s.target_id
      join districts d on d.id = c.district_id
      where s.status = 'pending' and s.target_type = 'crash' and s.kind in ('new_crash', 'add_source')
      order by (c.deaths >= 3) desc, s.created_at asc, s.id asc
      limit ${a.limit} offset ${a.offset}`),
});

export const submissionDetail = defineQuery({
  name: "submissions/detail",
  description:
    "Everything the decision screen shows about one submission: the proposal as reported, the crash\nit is about as it stands now, and the place names. Never selects the encrypted contact, only whether one exists.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.execute<{
      id: string; kind: string; status: string; via: string; flags: string[]; requiredApprovals: number; createdAt: string;
      submittedBy: string | null; hasContact: boolean; payload: unknown;
      crashId: string; crashStatus: string; occurredOn: string; occurredTime: string | null; deaths: number; injured: number | null;
      placeNameEn: string | null; placeNameNp: string | null; districtId: string; districtEn: string; districtNp: string;
      provinceEn: string; provinceNp: string; localUnitEn: string | null; localUnitNp: string | null;
      lat: number | null; lon: number | null; vehicles: string | null; sourceCount: number;
    }>(sql`
      select s.id, s.kind, s.status, s.via, s.flags, s.required_approvals as "requiredApprovals", s.created_at as "createdAt",
             s.submitted_by as "submittedBy", (s.contact_encrypted is not null) as "hasContact", s.payload,
             c.id as "crashId", c.status as "crashStatus", c.occurred_on::text as "occurredOn", c.occurred_time::text as "occurredTime",
             c.deaths, c.injured_total as injured, c.place_name_en as "placeNameEn", c.place_name_np as "placeNameNp",
             d.id as "districtId", d.name_en as "districtEn", d.name_np as "districtNp",
             p.name_en as "provinceEn", p.name_np as "provinceNp", lu.name_en as "localUnitEn", lu.name_np as "localUnitNp",
             case when c.location is null then null else ST_Y(c.location::geometry) end as lat,
             case when c.location is null then null else ST_X(c.location::geometry) end as lon,
             (select string_agg(v.type::text, ',' order by v.type) from crash_vehicles v where v.crash_id = c.id) as vehicles,
             (select count(*)::int from crash_sources cs where cs.crash_id = c.id) as "sourceCount"
      from submissions s
      join crashes c on c.id = s.target_id
      join districts d on d.id = c.district_id
      join provinces p on p.id = c.province_id
      left join local_units lu on lu.id = c.local_unit_id
      where s.id = ${a.id} and s.target_type = 'crash'`),
});

export const sourceForReview = defineQuery({
  name: "submissions/source",
  description: "The source a submission points at: a news link, or a witness statement (private, shown to reviewers only).",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.execute<{ id: string; kind: string; url: string | null; textPrivate: string | null }>(
      sql`select id, kind, url, text_private as "textPrivate" from sources where id = ${a.id}`,
    ),
});

export const reviewsForSubmission = defineQuery({
  name: "submissions/reviews",
  description: "The decisions already made on a submission, with the reviewer's name, oldest first.",
  example: { submissionId: EXAMPLE_ID },
  build: (db, a: { submissionId: string }) =>
    db.execute<{ id: string; reviewerId: string; reviewerName: string; decision: string; reasonCode: string | null; note: string | null; createdAt: string }>(sql`
      select r.id, r.reviewer_id as "reviewerId", u.name as "reviewerName", r.decision, r.reason_code as "reasonCode", r.note,
             r.created_at as "createdAt"
      from reviews r join users u on u.id = r.reviewer_id
      where r.submission_id = ${a.submissionId}
      order by r.created_at, r.id`),
});

export const lockSubmission = defineQuery({
  name: "submissions/lock",
  description: "Locks one submission for the rest of the transaction, so two reviewers deciding at once are handled one after the other.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.select({
      id: submissions.id, kind: submissions.kind, status: submissions.status, targetId: submissions.targetId,
      submittedBy: submissions.submittedBy, requiredApprovals: submissions.requiredApprovals, payload: submissions.payload,
    }).from(submissions).where(eq(submissions.id, a.id)).for("update").limit(1),
});

export const districtSlug = defineQuery({
  name: "submissions/district-slug",
  description: "A district's slug, for the public slug of a crash that is being published.",
  example: { districtId: EXAMPLE_ID },
  build: (db, a: { districtId: string }) => db.select({ slug: districts.slug }).from(districts).where(eq(districts.id, a.districtId)).limit(1),
});

export const crashSourceCount = defineQuery({
  name: "submissions/crash-source-count",
  description: "How many sources a crash has, to set its verification level when it is published or gains a source.",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) => db.select({ n: count() }).from(crashSources).where(eq(crashSources.crashId, a.crashId)),
});

// --- Writes (inside the decision transaction) -----------------------------------------------

type Reason = "duplicate" | "no_source" | "wrong_info" | "abuse" | "graphic" | "off_topic";

export const insertReview = defineQuery({
  name: "submissions/insert-review",
  description: "Records one reviewer's decision. The unique index stops a reviewer deciding the same submission twice.",
  example: { submissionId: EXAMPLE_ID, reviewerId: EXAMPLE_ID, decision: "reject" as "approve" | "reject" | "request_changes", reasonCode: "no_source" as Reason | null, note: "No link works" as string | null },
  build: (db, a: { submissionId: string; reviewerId: string; decision: "approve" | "reject" | "request_changes"; reasonCode: Reason | null; note: string | null }) =>
    db.insert(reviews).values(a).returning({ id: reviews.id }),
});

export const closeSubmission = defineQuery({
  name: "submissions/close",
  description: "Moves a pending submission to its final state. Does nothing if it is no longer pending.",
  example: { id: EXAMPLE_ID, status: "approved" as "approved" | "rejected" | "changes_requested" },
  build: (db, a: { id: string; status: "approved" | "rejected" | "changes_requested" }) =>
    db.update(submissions).set({ status: a.status, updatedAt: sql`now()` })
      .where(and(eq(submissions.id, a.id), eq(submissions.status, "pending"))).returning({ id: submissions.id }),
});

export const publishCrash = defineQuery({
  name: "submissions/publish-crash",
  description: "A draft crash goes public with its real slug (SPEC 7.3): status published, version up by one.",
  example: { crashId: EXAMPLE_ID, slug: "2026-11-12-dhading-a1b2c3", verification: "single_source" as "single_source" | "multi_source" },
  build: (db, a: { crashId: string; slug: string; verification: "single_source" | "multi_source" }) =>
    db.update(crashes).set({ status: "published", slug: a.slug, verificationLevel: a.verification, version: sql`${crashes.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(crashes.id, a.crashId), inArray(crashes.status, ["draft", "pending"]))).returning(),
});

export const rejectCrash = defineQuery({
  name: "submissions/reject-crash",
  description: "A rejected new report's draft crash is marked rejected; it stays in the database for the record.",
  example: { crashId: EXAMPLE_ID },
  build: (db, a: { crashId: string }) =>
    db.update(crashes).set({ status: "rejected", version: sql`${crashes.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(crashes.id, a.crashId), inArray(crashes.status, ["draft", "pending"]))).returning(),
});

export const attachFollowUpSource = defineQuery({
  name: "submissions/attach-source",
  description: "An approved addition: the source joins the crash as a follow-up. Joining twice does nothing.",
  example: { crashId: EXAMPLE_ID, sourceId: EXAMPLE_ID },
  build: (db, a: { crashId: string; sourceId: string }) =>
    db.insert(crashSources).values({ ...a, relation: "follow_up" }).onConflictDoNothing().returning({ sourceId: crashSources.sourceId }),
});

export const bumpCrashVersion = defineQuery({
  name: "submissions/bump-crash",
  description: "Adds one to a published crash's version after an approved addition, and sets its verification level.",
  example: { crashId: EXAMPLE_ID, verification: "multi_source" as "single_source" | "multi_source" },
  build: (db, a: { crashId: string; verification: "single_source" | "multi_source" }) =>
    db.update(crashes).set({ version: sql`${crashes.version} + 1`, verificationLevel: a.verification, updatedAt: sql`now()` })
      .where(eq(crashes.id, a.crashId)).returning(),
});

export const scheduleContactPurge = defineQuery({
  name: "submissions/schedule-contact-purge",
  description: "A reporter's contact is deleted 30 days after the decision (SPEC 12.3).",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) =>
    db.update(submissions).set({ contactPurgeAfter: sql`now() + interval '30 days'` })
      .where(and(eq(submissions.id, a.id), sql`${submissions.contactEncrypted} is not null`)),
});
