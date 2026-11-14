# Plan: report a crash, flood limits and the database

*13 Nov 2026. A feature plan under [`PLAN.md`](../PLAN.md). It covers UI-07 and the parts of P0-04, P0-07, P0-10, P1-01, P1-03, P1-04, P1-06 and P1-11 that this feature needs. Read it with SPEC 4, 7.1, 7.3, 10 and 12.2.*

---

## 1. What we are building

**Outcome:** someone on a phone, with no account, reports a crash on one short page in under 2 minutes. The report lands in Postgres as a draft crash with a pending submission. Nobody can flood the form. Every SQL statement the app runs can be read in one folder.

**Done when all of these are observed:**

1. At 360 px, with JavaScript **off**, a visitor fills the form and sees "Thanks, a reviewer will check this" with a reference code.
2. The database then holds one `draft` crash, its vehicle and source rows, one `pending` submission, one revision and one audit row. The draft appears on no public page.
3. The 4th report in an hour from one device is refused with a clear message in both languages. The site-wide daily cap also works.
4. Entering the date and district of an existing crash shows "Is it one of these?" before anything is saved. Picking one creates an "add a source" submission instead of a new crash.
5. `db/migrations/` and `db/queries/` hold every migration and every query as SQL. A test fails if a query changes without its `.sql` file being regenerated.
6. `pnpm check` passes. Screenshots at 360, 390 and 1440 px in both languages show no errors or overflow.

**Not in this plan** (later tasks): login and "My contributions" (P0-08, P1-13), the review queue (P1-07), paste a news link (P2-10), the map pin (P1-05), people and photos, number plates. Until P1-07 exists, reviewers read pending reports with `pnpm db:pending`.

---

## 2. Decisions (owner, 13 Nov 2026)

| Question | Decision | What changes |
|---|---|---|
| Must people log in to report? | **No.** Anyone can report. Captcha, limits and a daily cap protect the form; every report goes to review | SPEC 4.2 "Create a crash" becomes "→ review" for visitors; SPEC 7.1 item 2 drops "(logged in)"; SPEC 12.2 gets a row for anonymous reports. New ADR `0004-anonymous-crash-reports.md` |
| How is database code kept? | **Drizzle**, as the spec says. All SQL is kept in one folder, `db/` (section 4) | New ADR `0005-database-layout.md` |
| What shape is the form? | **One short page**, 4 numbered sections; no People step | UI-07 in PLAN 8A is simplified; the handoff's 5-step wizard is not built |

Because no-login reports can only ever create drafts, the existing rule still holds: *a crash whose only source is a contributor needs 2 approvals* (SPEC 7.4). Every anonymous report with no news link is therefore flagged `needs_two_approvals`.

---

## 3. The form

One page at `/[locale]/submit`. It uses the shared site header and footer, a plain HTML `<form>` posting to a server action, and works without JavaScript. Required fields are marked; everything else can be skipped.

| # | Section | Fields | Notes |
|---|---|---|---|
| 1 | **When** | Date (**required**). BS by default: three selects (year, month, day), pre-set to today in Nepal. A link switches to an AD date input. Time (optional) | BS and AD both go through `lib/domain/bs-date.ts`. Not in the future, not more than 20 years ago (SPEC 7.1) |
| 2 | **Where** | District (**required**, a select of 77, names in the visitor's language). Place name (optional, free text, e.g. "Malekhu bazaar"). Local unit (optional; appears after a district is picked, JavaScript only). "Use my location" (optional, JavaScript only) | Location is checked against our official border with PostGIS. A point outside Nepal is refused (SPEC 7.1) |
| 3 | **What happened** | Killed (**required**, 0–200, −/+ steppers of 44 px). Injured (0–200, default 0). Vehicles (optional chips: bus, microbus, jeep, car, truck, tipper, motorcycle, scooter, bicycle, other) | Steppers are plain number inputs without JavaScript. Hints come from the existing `Report` strings |
| 4 | **How do you know?** | Either a news link (URL), **or** "I saw it / I know about it" with a short description (max 1,000 characters). At least one is **required** | The description is a witness source, kept private for reviewers (`sources.text_private`) and never published |
| 5 | **Can we contact you?** (optional) | Email or phone, one field, with the note "Only reviewers see this, to ask a question about your report. We delete it 30 days after the report is checked." | Encrypted, visible only to reviewers, never published or exported (section 5) |
| — | Submit | Cloudflare Turnstile, a hidden honeypot field, and the button "Send for review" | |

**After submitting:**
- **Possible duplicate:** if crashes exist in the same district within ±2 days (drafts included, SPEC 7.1), the visitor first sees "Is it one of these?", with "Yes, add to this crash" or "None of these, it's a new crash". Without JavaScript this is a second page; with JavaScript the panel also appears live as soon as date and district are chosen.
- **Thanks:** "Thanks, a reviewer will check this, usually within 24 hours", plus a short reference code (the first 8 characters of the submission ID) to quote if they contact us.

**With JavaScript only (enhancements):** autosave to the device (`localStorage`, SPEC 7.1 "must"), the live duplicate panel, the local-unit select and "Use my location". The page must be complete and usable without any of them.

**Left out to stay simple** (a reviewer can add these, or a later task will): people and names, plates, crash type, highway, photos.

---

## 4. Database layout: all SQL in one folder

```text
db/
├─ README.md                 how to run it, the conventions below, how to read a query file
├─ migrations/               drizzle-kit output, committed. Generated from lib/db/schema/*.ts, plus
│                            hand-written "custom" migrations for what Drizzle can't express:
│                            extensions, roles and grants, check constraints, triggers, spatial indexes
├─ queries/                  one .sql file per query the app runs, GENERATED from lib/db/queries/*.ts
│  ├─ places/districts.sql
│  ├─ places/locate-point.sql
│  ├─ crashes/similar.sql
│  ├─ reports/create-draft-crash.sql  …
│  └─ maintenance/purge-rate-limits.sql
└─ seeds/                    invented development data only (no real names, PLAN rule 9)

lib/db/
├─ client.ts                 the one Postgres connection (postgres.js) wrapped by Drizzle
├─ schema/*.ts               tables (Drizzle)
└─ queries/*.ts              the ONLY place the app talks to the database. Each query is a named
                             function registered with defineQuery("crashes/similar", …)
infra/
├─ docker-compose.yml        PostGIS for development (image version pinned)
└─ db/init.sql               creates the roles: migrator, app, readonly (SPEC 12.3)
drizzle.config.ts            out: "db/migrations"
```

**How `db/queries/` stays true:** `pnpm db:queries` asks Drizzle for each registered query's SQL (`.toSQL()`) and writes it to `db/queries/<name>.sql`, with a header saying what it's for and what its parameters are. A test regenerates the files in memory and fails if any differs from what's committed. So every pull request shows the exact SQL change in its diff, and anyone can copy a query into `psql`. Spatial SQL that Drizzle can't build is written with Drizzle's `sql` template inside the same registry, so it's tracked the same way.

**Rules:**
- App code never imports `lib/db/client.ts` directly. It calls a function in `lib/db/queries/`. A test enforces this, like the policy coverage test.
- Migrations are forward-only (PLAN rule 8). Never edit a migration that has run anywhere; add a new one.
- Every write goes through one transaction that also writes `revisions` and `audit_log` (PLAN P0-10).
- The app connects as role `app`: no DDL, and only INSERT on `audit_log`. Migrations run as `migrator`.

---

## 5. Tables in this slice

Only what the form needs, but each table is defined as in SPEC 10, so later tasks add columns rather than redesign. Times are UTC; IDs are UUID v7.

| Table | Columns used now | From |
|---|---|---|
| `provinces`, `districts`, `local_units` | code, slug, `name_en`, `name_np`, `geom` | SPEC 10.1, P0-07 |
| `crashes` | slug, status, `occurred_on`, `occurred_time`, location, `location_precision`, `place_name_*`, `province_id`, `district_id`, `local_unit_id`, deaths, `injured_total`, `created_via`, `verification_level`, version | SPEC 10.2 |
| `crash_vehicles` | `crash_id`, type | SPEC 10.2 |
| `sources`, `crash_sources` | kind (news or witness), url, `normalized_url` (unique), `text_private` | SPEC 10.4 |
| `submissions` | kind (`new_crash` or `add_source`), `target_id`, payload, via (`web`), `submitted_by` (null), `ip_hash`, status, `required_approvals`, flags, **`contact_encrypted`**, **`contact_purge_after`** | SPEC 10.5; the two contact columns are new |
| `revisions`, `audit_log` | as in the spec; `audit_log` is append-only for `app` | SPEC 10.5, P0-10 |
| `rate_limits` *(new)* | `key`, `window_start`, `count`, primary key (key, window_start) | this plan |

**Database-enforced rules now** (SPEC 10.7): deaths and injured between 0 and 200; `occurred_on` not in the future; unique slugs and `normalized_url`; `ON DELETE RESTRICT`; GiST on geometry; B-tree on (`district_id`, `occurred_on`).

**Contact details**, following the rule SPEC 12.3 already sets for family claimants' phone numbers:
- Stored only in `submissions.contact_encrypted`, encrypted with AES-256-GCM. The key comes from the environment (`CONTACT_ENCRYPTION_KEY`) and is never stored in the database or in backups.
- Decrypted only for a reviewer looking at that submission; the policy action is `read_contact`, reviewers and admins only.
- Never in the payload, revisions, audit rows, public pages, exports, the API or logs.
- When a reviewer decides the submission, `contact_purge_after` is set to the decision time plus 30 days. `db/queries/maintenance/purge-contacts.sql` sets expired values to null (run by hand until the worker exists, then nightly).

**Draft slugs:** a draft gets a temporary slug (`draft-<short id>`); the real slug (BS date, place, vehicle) is made on approval (P1-02).

---

## 6. Flood protection

Checked in this order on every submit, before anything is written:

| Layer | Rule | Why |
|---|---|---|
| Kill switch | `REPORTS_ENABLED=false` in the environment closes the form with a polite notice | Instant stop during an attack, without a deploy |
| Honeypot | A hidden field that people never fill; if filled, pretend success and store nothing | Stops simple bots for free, no JavaScript |
| Captcha | Cloudflare Turnstile, verified on the server. Development uses Cloudflare's published test keys | SPEC 11.2. Real keys need the Cloudflare account (O-3) |
| Per person | **3 per hour and 10 per day**, counted per device (IP hash), because there are no accounts to count by | Matches SPEC 12.2's 3 per hour for anonymous tips. People sharing one Wi-Fi or mobile network share a count; the numbers are generous for that reason |
| Site-wide | **300 anonymous reports per day** in total; above that the form says "We're receiving many reports right now, please try again tomorrow" | Protects reviewers if a botnet gets past the captcha |
| Size | Zod limits on every field (place name 120, description 1,000, URL 2,000 characters) | SPEC 12.2 |
| Same link | A news URL already attached to a crash routes to "add to that crash", not a new draft | Stops repeats of the same story |

**How the counting works:**
- One SQL statement per limit: `INSERT … ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`. It is atomic and needs no Redis (SPEC 11.2), and it lives in `db/queries/rate-limit/hit.sql`.
- The IP is hashed: HMAC-SHA256 of `CF-Connecting-IP` with a secret from the environment (`IP_HASH_SECRET`). The raw IP is never stored. Rows older than 30 days are purged (SPEC 12.3), with `db/queries/maintenance/purge-rate-limits.sql` run by hand until the worker exists.
- **Caveat:** `CF-Connecting-IP` can only be trusted once the server accepts traffic from Cloudflare alone (P0-14). In development it falls back to the socket address.
- All numbers live in one file, `lib/net/rate-limit.ts`, and are copied into SPEC 12.2.

---

## 7. Steps

Each step ends with a check that must be observed (PLAN section 1).

0. **Record the decisions.**
   - Do: ADR 0004 and 0005; edit SPEC 4.2, 7.1, 11.3 and 12.2 to match section 2, and SPEC 12.3 to list reporters' optional contact details; update PLAN 1A, 8A (UI-07) and the task status lines.
   - Check: the spec and plan say the same thing about login and `db/`.
1. **Local database** (P0-04).
   - Do: `infra/docker-compose.yml` with a pinned PostGIS image; `infra/db/init.sql` with the three roles; `drizzle.config.ts`; `lib/db/client.ts`; the first custom migration enabling `postgis`, `pg_trgm` and `unaccent`; scripts `db:up`, `db:down`, `db:migrate`, `db:studio`, `db:reset`; `.env.example` with `DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `IP_HASH_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `CONTACT_ENCRYPTION_KEY` and `REPORTS_ENABLED` (names only, never values; real values live in the server's environment file, SPEC 12.2).
   - Read first: the current Drizzle, drizzle-kit and postgres.js docs; pin exact versions.
   - Check: `select postgis_version();` answers; `pnpm db:reset && pnpm db:migrate` runs from empty; the `app` role cannot `CREATE TABLE`.
2. **The query registry and `db/queries/`.**
   - Do: `defineQuery`, `pnpm db:queries`, the snapshot test, and the test that only `lib/db/queries/` imports the client.
   - Check: changing one query without regenerating makes `pnpm check` fail; regenerating fixes it.
3. **Places** (P0-07, the part this form needs).
   - Do: schema and `scripts/import-boundaries.ts` from `data/raw/okfn/`, with districts dissolved from local units as the map build already does. Find an openly licensed list of Nepali names for provinces, districts and local units, and record its licence in ADR 0002. **If none is found, stop and ask.** Districts can never be shown in English only on the Nepali page.
   - Check: 7 provinces and 77 districts with both names; the local-unit count is reconciled against 753 (the source has 755; ADR 0002); `locate-point.sql` puts a point in central Kathmandu in the right local unit and a point in India in none.
4. **Core tables, revisions and audit** (P1-01 and P0-10, this slice only).
   - Do: the tables in section 5, their constraints, `rate_limits`, and the INSERT-only grant on `audit_log`.
   - Check: database tests show that a negative death count, a future date, a duplicate `normalized_url`, and an `UPDATE audit_log` as `app` are all rejected.
5. **Policy and validation.**
   - Do: visitors may `create_crash` → review (matrix data and its test updated from SPEC 4.2); a Zod schema for the form shared by the page and the action, in `lib/forms/report.ts`.
   - Check: unit tests cover future dates, more than 20 years ago, counts outside 0–200, no source given, and over-long text. The matrix test passes with the new cell.
6. **Flood protection.**
   - Do: `lib/net/rate-limit.ts`, `lib/net/ip-hash.ts` and `lib/net/turnstile.ts`, plus the kill switch and the honeypot.
   - Check: database tests show the 4th report in an hour refused, the 11th in a day refused, and the site-wide cap refusing everyone; a filled honeypot stores nothing; a failed Turnstile token is refused.
7. **The page** (UI-07, simplified).
   - Do: `app/[locale]/submit/page.tsx` and `components/report/*`. Districts are read from the database with `"use cache"`, since it's reference data that rarely changes. Follow the light nav and the handoff tokens (square fields 48 px high, ink chips, red only on the primary button).
   - Check: rule 14 screenshots in both languages at 360, 390 and 1440 px; the nav test passes.
8. **Saving a report.**
   - Do: the server action `lib/workflow/report.ts`. It runs policy → honeypot → kill switch → captcha → limits → Zod → duplicate check → one transaction (draft crash, vehicles, source, `crash_sources`, submission, revision, audit) → the thanks page. Flags: `anonymous`, `needs_two_approvals` (no news link), `possible_duplicate`.
   - Check: a database test submits once and finds exactly the rows listed in section 1, item 2; the draft is absent from every public query. A report with a contact stores it only encrypted: the plain text appears in no column, revision, audit row or log line, and the purge query clears it once `contact_purge_after` has passed.
9. **Duplicate check.**
   - Do: `db/queries/crashes/similar.sql` (same district, ±2 days, drafts included, not merged or rejected); the confirm page without JavaScript; the live panel with JavaScript, through a small route handler that calls the policy and the rate limit.
   - Check: entering a seeded crash's date and district shows it; choosing it creates an `add_source` submission and no new crash.
10. **Development seed** (part of P1-03).
    - Do: `db/seeds/` puts the invented crashes from `lib/sample/data.ts` into the database as `published`, so the duplicate check has something to find.
    - Check: `pnpm db:reset && pnpm db:migrate && pnpm db:seed` gives a working form with duplicates to find.
11. **Enhancements.**
    - Do: autosave on the device, the local-unit select and "Use my location" (the point is checked by `locate-point.sql`).
    - Check: fill half the form, reload, and the values are back; a location in India is refused with a clear message.
12. **Finish.**
    - Do: a Playwright test at 360 px that submits with JavaScript and again with JavaScript disabled; `pnpm db:pending` to list waiting reports; tick the PLAN boxes whose checks were observed and write a phase note.
    - Check: all items in section 1 observed.

**Order and size.** Steps 0–4 are the database foundation, about 2 days. Steps 5–9 are the form and its protection, about 2 days. Steps 10–12 take about 1 day. Nothing here waits on an owner task: Turnstile works with test keys until O-3 is done.

---

### Progress

| Step | State | Evidence |
|---|---|---|
| 0 Decisions recorded | **Done**, 13 Nov 2026 | ADR 0004 and 0005; SPEC 4.1, 4.2, 7.1, 11.3, 12.1, 12.2 and 12.3 edited; `can()` lets visitors create a crash → review with captcha (matrix test updated, 104 policy tests pass) |
| 1 Local database | **Done**, 13 Nov 2026 | `pnpm db:up` starts PostGIS 3.6 on PostgreSQL 18; `pnpm db:migrate` applies `0000_extensions` from an empty volume. Observed: `app` gets "permission denied" for `CREATE TABLE` and `CREATE SCHEMA`; `migrator` can create tables |
| 2 Query registry | **Done**, 13 Nov 2026 | `defineQuery`, `run`, `transaction`, `pnpm db:queries`, `lib/db/queries.test.ts`, `lib/db/boundary.test.ts`. Observed: changing a query's SQL without regenerating fails the test with the SQL diff; reverting passes. `pnpm check`: 147 tests |
| 3 Places | **Done**, 13 Nov 2026 | `pnpm db:places` loads 7 provinces, 77 districts and 753 local units with Nepali and English names (names: `sagautam5/local-states-nepal`, MIT). Observed: official type counts (6 / 11 / 276 / 460); Kathmandu, Gunji and an Indian point resolve correctly through `places/locate-point.sql`; non-exact name matches in `docs/data/place-name-matches.csv`; ADR 0002 updated. `pnpm check`: 165 tests |
| 4 Core tables | **Done**, 13 Nov 2026 | Migrations 0002 (crashes, vehicles, sources, submissions, revisions, audit_log, rate_limits) and 0003 (audit_log INSERT-only for `app`). `pnpm test:db` (needs the local database): negative deaths, future date, duplicate link and 3 approvals rejected; `app` can't update or delete audit rows or create tables |
| 5 Policy and validation | **Done** | `can(null, "create_crash")` → review with captcha; `lib/forms/report.ts` + 12 tests |
| 6 Flood protection | **Done** | `lib/net/{rate-limit,ip-hash,turnstile,contact-crypto}.ts`; database tests: 4th report in an hour, 11th in a day and the 301st site-wide are refused |
| 7 The page | **Done** | `/ne/submit`, `/en/submit`; shared header and footer; screenshots at 360 and 1440 px, both languages, no errors |
| 8 Saving a report | **Done** | `lib/workflow/report.ts`, `app/[locale]/submit/actions.ts`. Observed in a real browser: a submission produced the thank-you page with a reference code, and the database held a draft crash, its vehicle and witness source, a pending submission (2 approvals, flags `anonymous`, `needs_two_approvals`), one revision and one audit row. Database tests also prove the contact is stored only encrypted |
| 9 Duplicate check | **Partly**: the confirm step works (observed in a browser: same district and date → "Is it one of these?" → "Yes, add to this crash" created an `add_source` submission and no new crash). **Left:** the live panel while typing | — |
| 10–12 | Not started (seed data, autosave / local unit / "use my location", Playwright test, `pnpm db:pending`) | — |

**Deviations decided while building (13 Nov 2026):**
- **The form needs JavaScript to send.** It renders and fills in without JavaScript, but Cloudflare Turnstile (the captcha the owner asked for) only works with JavaScript; a `<noscript>` notice says so. Done criterion 1 ("JavaScript off") is replaced by "on a phone at 360 px".
- **The captcha is checked only at the final save**, after the duplicate question, because a token can be used once.
- **Drafts in "Is it one of these?" show only the date and counts**, never their place or text: nobody has checked that text yet.
- **A visitor adding to an existing crash** is covered by the `create_crash` permission (visitors have no `add_news_link` right); it is always a pending `add_source` submission.
- **Each district is read per request** (inside `<Suspense>` with `connection()`), so `next build` never needs a database.

## 8. Risks

| Risk | What we do |
|---|---|
| No openly licensed Nepali names for districts and local units | Stop and ask (step 3). The form can't ship in Nepali without them |
| A botnet gets past the captcha | The site-wide cap protects reviewers; the kill switch stops it at once; Cloudflare bot rules (P0-14) |
| `CF-Connecting-IP` is spoofable until the origin accepts Cloudflare only | Development only; P0-14 closes it before anything is public |
| A contact detail leaks (a log line, a backup, an export) | Encrypted with a key kept outside the database and backups; excluded from payload, revisions and audit by design; a test checks the plain text appears nowhere; purged 30 days after the decision |
| Someone reports a living person as dead | Not possible from this form: it has no people step. Names arrive later with a source and need 2 approvals (SPEC 7.4) |
| Drizzle can't produce SQL for some query (`toSQL` without a live connection, spatial functions) | Write it with the `sql` template in the registry; check `toSQL` without a connection in step 2, before building on it |
| Database reads in pages vs Cache Components | Reference data uses `"use cache"`; anything per request sits inside `<Suspense>` (the crash page pattern) |
| Server actions without JavaScript | Confirm the progressive-enhancement behaviour in the installed Next docs in step 7, before writing the form |
| Windows development | Docker Desktop is already running here; document `pnpm db:up` in `db/README.md` |

---

## 9. Questions settled (owner, 13 Nov 2026)

1. **Optional contact:** yes, one optional field for an email or phone, encrypted, reviewers only, purged 30 days after the decision (sections 3 and 5). It must be named in the privacy policy (P5-06).
2. **Limits:** 3 per hour and 10 per day per person (counted per device), and 300 per day for the whole site.
3. **District:** required.
