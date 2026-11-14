# 0008: Staff edits publish directly; the review queue

Date: 14 Nov 2026. Status: accepted (owner's decision).

## Context

SPEC 4.2 sent every new crash and every added person to review, including ones entered by reviewers and admins, and `canDecide` forbids anyone from approving their own submission. With one admin and a few reviewers, a crash entered by the admin could never be published. The owner asked for staff to be able to create and edit crashes and people.

## Decision

- **Staff publish directly, logged.** For a reviewer or admin, "create a crash" and "add a person" are now allowed at once, post-moderated (SPEC 4.2 and `lib/policy/can.ts` changed). Editing crash facts was already direct for both, with a reason required for reviewers. Every direct change keeps a revision (full history) and an audit row, and can be reverted.
- **Visitor and contributor items still need a reviewer.** A visitor's report creates a draft crash and a pending submission. A reviewer or admin decides it in `/review/submissions`: approve, reject (with a reason code) or ask for changes. Rules, all in `lib/workflow/decide.ts` and enforced in one transaction: never your own submission, never twice, two different reviewers where two approvals are required (a witness-only report), a rejection needs a reason (also a database check).
- **Approving** a new crash gives it its public slug (`<date>-<district>-<random>`), sets it to `published`, raises its version and writes a revision. Approving an addition attaches the source, raises the version and updates the verification level. A reporter's contact is scheduled for deletion 30 days after any decision (SPEC 12.3).
- **Decisions cannot be edited.** The `reviews` table is append-only for the website (like `audit_log`), and the public API role cannot read it.
- **Unchanged, on purpose:** the SPEC 4.2 table still lets an **admin** delete or merge directly and requires **two approvals** from reviewers. The owner's option text said deleting and merging needed a second person; with a single admin that would make it impossible, so the table's rule stands. Revisit if the team grows.

## The staff editor (built 14 Nov 2026)

`/review/crashes` lists every crash (filter: all, public, drafts, rejected); `/review/crashes/[id]` edits it; `/review/crashes/[id]/history` shows every version of the crash and its people and restores any of them.

- **Every change needs a reason**, is **version-checked** (a stale editor is told someone else changed it and nothing is overwritten), and writes a revision (the full snapshot, who, why) and an audit row, in one transaction (`lib/workflow/edit-crash.ts`). The `revisions` table is append-only for the website.
- **People** (`persons` table): name in English or Nepali, age, sex, road role, hometown, status (killed, injured, not hurt), name visibility, draft or published. Their address is opaque (`p-` and random hex), never made from the name. Rules enforced in the workflow: no more people recorded as killed than the crash's death count (and the count cannot drop below them); a person can be published as killed only when the crash has a news source (SPEC 7.4); an injured child's name stays hidden unless the family asked (SPEC 2). Removing a person is admin only, and the history keeps their last version.
- **Restoring** puts an earlier version back as a new version. A crash restores its facts and vehicles, not its public or draft state. A removed person is added back with the same id and address.
- **Publishing** a draft crash needs at least one source and gives it its public slug; unpublishing takes it back to draft and keeps the slug.
- `sources.normalized_url` has one format, the report form's (`host/path`). The news worker's normalizer is only for `feed_items`; convert with the report form's function when a feed item becomes a source.

## Consequences

- Built so far: the queue (`/review/submissions`) and decision screen for the two kinds the report form creates (`new_crash`, `add_source`), and the staff crash and person editor with history and restore. Not built: edit-and-approve, showing the reporter's contact to reviewers, keyboard shortcuts, the other queue tabs, the staff report form with people, memorials and photos, merging and deleting crashes.
- Public pages still show sample data, so an approved crash is public in the database but not yet on the site (PLAN P1-08).
