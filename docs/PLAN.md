# Sadak Smriti: build plan

*Version 1.1, 13 Nov 2026. Companion to [`SPEC.md`](SPEC.md) (version 1.2). The spec says **what** we build and why. This plan says **in what order, in which files, and how each step is checked**. The design handoff in [`design_handoff_sadak_smriti/README.md`](../design_handoff_sadak_smriti/README.md) says **how the public screens look**.*

*Changes in 1.1: a status section (1A); the visual design and map decisions added to section 3; working rules 12 to 15 for sample data, disabled controls, screenshots and the design source; the repository skeleton updated to what exists; a status line on every Phase 0 task; new tasks P0-17 (design system and site shell) and P0-18 (static map renders); a new UI track (section 8A) for the seven handoff screens; design and wiring notes on P1-05, P1-08, P1-09, P3-05, P4-03 and P4-04; three new per-PR checks; the first phase note.*

---

## 1. How to use this plan

- Work top to bottom. Each task has an ID (for example `P1-07`), the files it touches, and a **check** that proves it works.
- A task is finished only when its check has been **observed**: the test was run, the page was opened, the row was seen in the database. "It compiles" is not a check.
- Tick the box when a task is done. If a task turns out to be wrong or unnecessary, don't delete it: strike it through and write one line saying why.
- Section references such as "SPEC 7.4" point to `SPEC.md`.
- If the plan and the spec disagree, **the spec wins**. Fix the plan in the same commit.
- Anyone (a person or an AI model) picking up a task should read sections 1A to 5 of this plan first, then the spec sections the task names. For any screen, also read the matching part of the design handoff README.
- Each task in progress has a **Status** line. It says what exists, what was observed, and what is left. Update it in the same change as the work.

---

## 1A. Where things stand (13 Nov 2026)

**In one line:** the bilingual site shell, the design system, the map data pipeline and two of the seven public screens (Home and Full map) exist and run locally on invented sample data. Nothing is in a database, nothing is deployed, and the repository has no commits yet.

**What runs today**

| Area | State | Evidence |
|---|---|---|
| Next.js app, `/ne` and `/en` | Runs locally (`pnpm dev`) | Both locales return 200; `pnpm build` prerenders `/ne`, `/en`, `/ne/map`, `/en/map` |
| Checks | `pnpm check` (lint, type check, Vitest) passes | 4 test files, 135 tests |
| Home (handoff screen 1) | Built on sample data | Screenshots at 360, 390 and 1440 px in both languages |
| Full map (handoff screen 2) | Built on sample data, static map; interactive controls disabled | Screenshots at 360, 390 and 1440 px in both languages |
| 404 page | Localised; any unknown path under `/ne` or `/en` shows it | `/en/xyz` returns 404 |
| Crash page (handoff screen 3) | Built on sample data; the Home and map links to it now work | `pnpm build` prerenders every sample crash in both languages; screenshots at 360, 390 and 1440 px |
| Remember, Person, Highway, Data pages (screens 4 to 6, and `/remember`) | Built on sample data; charts are server-rendered SVG with tables and CSV | screenshots at 360 and 1440 px in both languages; `pnpm build` prerenders them |
| Contribute page and share cards (UI-08) | Built, with real content from `content/contributors.json` (five invented sample entries for now) | generated cards opened in both languages; `pnpm build` prerenders every profile |
| Map data | `public/map/*.geojson`, `base-ink.svg`, `base-light.svg`, `kathmandu-streets.svg`, and `public/tiles/nepal-basemap.pmtiles` built | `pnpm map:download`, `pnpm map:build`; ADR 0002 |
| BS dates | Wrapper and tests done | ADR 0003 |
| Permissions | `can()`, the matrix test and the route-coverage test pass | `lib/policy/*` |
| Database | Local PostGIS in Docker, three roles, migrations, and the query registry with `db/queries/` snapshots. No tables yet besides the migration journal | `pnpm db:up && pnpm db:migrate`; `db/README.md` |
| Crash report form (`/submit`) | Works end to end against the real database: validation, flood limits, duplicate question, encrypted contact; steps 0-9 of 12 done (live duplicate panel, autosave, local unit and location, browser test and seed data are left) | `docs/plans/report-a-crash.md`; `pnpm test:db`; ADR 0004, 0005 |
| Login | Built (Google only, staff 2FA); real Google sign-in waits on O-5 | ADR 0006 |
| News worker | Collect and filter built; extraction not started | ADR 0007 |
| CI, containers, server, backups | Not started | — |

**Known issues and loose ends** (fix inside the task named, or as a small cleanup before the first commit)

1. **No git commits yet.** Every file is untracked. Make the first commit after P0-01 and P0-02 are checked, so no real data can enter history.
2. **`pnpm dev:sample` does nothing different.** The `SAMPLE_DATA` flag is read nowhere; pages always import `lib/sample/data.ts`. Either remove the script or make pages choose sample data or the database through this flag (decide in P1-08).
3. **`.impeccable/surfaces/app-locale-page-tsx.md` describes the old Survey Toposheet design**, replaced on 13 Nov 2026. Update or delete it so no one builds against it.
4. **Dev server worker crash.** After a long `next dev` session, pages can fail with "Jest worker encountered 2 child process exceptions" while generating static paths. A production build of the same code is clean. Restart the dev server and delete `.next/dev`. If it starts happening on short sessions, investigate before working around it.
5. **The Next.js dev indicator** (bottom-left "N") overlaps content in dev screenshots. It is not in production builds; ignore it when reviewing screenshots, or turn it off in `scripts/dev/screenshot.mjs`.
6. **ADR numbering:** `0001` is missing; `0002` is map sources (not "boundary dataset" as P0-07 first said). P0-16 adds the rest.
7. **Calendar deadline:** BS date tables are unconfirmed from BS 2084 (mid-April 2027). See ADR 0003; act before April 2027.

---

## 2. Goal and definition of done

**Goal:** a public website where every reported road crash in Nepal is recorded with its sources, every person killed has a memorial page their family can control, and the data is open for research.

**The MVP is done when all of these are true on the production site:**

1. A visitor on a phone can open the home page, the map, a crash page and a person page in Nepali or English, and each loads within the limits in SPEC 11.4.
2. A logged-in contributor can report a crash from a phone in under 3 minutes, and is warned if it's already recorded.
3. The news pipeline drafts crashes from the outlets' feeds without help, and many articles about one crash become one draft.
4. A reviewer can clear the queue from a phone. Nothing reaches the public without approval, and the two-approval rules hold.
5. A family member can claim a person, add a story, photos and links, and hide the memorial.
6. Anyone can report content. "This person is alive" hides the page at once under the rules in SPEC 7.5.
7. The dashboard, the downloads and the API give the same totals, and the downloads contain no names.
8. The backup has been restored successfully at least once, and every item in SPEC 12.2 and 12.4 is ticked.

**Unhappy paths that must also work:** no crashes yet (empty states), a lost connection during a submission (the draft is kept on the device), a feed or the AI service being down (the queue shows it; nothing is lost), a reviewer trying to approve their own submission (refused), and a full disk or failed backup (an alert email arrives).

---

## 3. Decisions already made

Don't reopen these without a new reason. The full list with reasons is in SPEC section 2; the twelve follow-up questions are settled in SPEC section 16.

| Area | Decision |
|---|---|
| Stack | TypeScript, Next.js (App Router), PostgreSQL + PostGIS, Drizzle, Zod, pg-boss, next-intl, MapLibre + PMTiles, Tailwind |
| Hosting | One Hostinger VPS (KVM 2, India), Docker Compose, Caddy, Cloudflare free plan in front |
| Login | Google only; two-factor (authenticator app) for reviewers and admins; roles set only on the server (ADR 0006) |
| Review | 1 approval normally, 2 for sensitive actions; reviewers are invited |
| AI | Claude Haiku 5.5 first, Sonnet 5.5 for hard articles; $25 monthly cap; model chosen by the evaluation |
| Privacy | Injured adults shown as in the news with an opt-out; injured children hidden by default; injured people's pages are not indexed by search engines |
| Licences | AGPL-3.0 code, CC BY 4.0 crash data, name and logo reserved, family content not open |
| Languages | Nepali and English from day one |
| Article text | Kept privately for 12 months, then only its hash |

**Decisions made during Phase 0 work (13 Nov 2026).** These are recorded in `CLAUDE.md` and the ADRs named. Don't reopen them without a new reason.

| Area | Decision | Where recorded |
|---|---|---|
| Framework versions | Next.js 16.4 with `cacheComponents` and `partialPrefetching` on; request middleware is `proxy.ts` (renamed in Next 16); `params` is a Promise; `output: "standalone"` for the Docker image. Read `node_modules/next/dist/docs/` before using a Next API | `CLAUDE.md`, `next.config.ts` |
| Languages | next-intl 4.15 with its Cache Components setup (`next/root-params`), `localePrefix: "always"`, default `ne`. A visitor with `CF-IPCountry: NP` goes to `/ne` even with an English browser; a language they chose (the `NEXT_LOCALE` cookie) always wins | `proxy.ts`, `lib/i18n/*` |
| Visual design | The **Modernist system** in `design_handoff_sadak_smriti/` (it replaced the earlier "Survey Toposheet" direction). Square corners everywhere; 2px ink rules between sections, 1px neutral-400 hairlines between rows; flush-left text; **red means death** (death counts, roads coloured by deaths per km, crash dots, the primary button, nothing else); greyscale faces, never crash photos | Handoff README, `app/globals.css` |
| Two surfaces | The **ink map** surface for the Home hero and the Full map; the **light ground** for every content page and the small maps inside them | Handoff README "Theme rules" |
| Fonts | Archivo 400/600/800 for Latin and Noto Sans Devanagari for Nepali, self-hosted through `next/font` | `app/[locale]/layout.tsx` |
| National border | The official 2020 map (Lipulekh, Kalapani and Limpiyadhura inside Nepal), drawn solid. Never draw the OSM or Protomaps boundary layers. The map build stops if three check points fall outside Nepal | ADR 0002 |
| Map sources | Boundaries: Open Knowledge Nepal `localboundaries` (CC BY 4.0), pinned commit. Highways: OSM `ref=NH..` via Overpass (ODbL). Basemap: Protomaps build cut to Nepal, about 330 MB PMTiles, served from our own server | ADR 0002, `scripts/map/*` |
| Map rendering | **Two renderers, one style.** (1) A static SVG map, built from our own GeoJSON at build time and rendered on the server, for the Home hero and the small maps on inner pages: no map JavaScript, works on slow phones (SPEC 6.2). (2) MapLibre with our PMTiles for the interactive Full map, loaded only on `/map` (P1-09). Both read colours and widths from `lib/map/style.ts` | `components/map/static-map.tsx`, `lib/map/*` |
| BS dates | `nepali-date-converter`, wrapped by `lib/domain/bs-date.ts` (the only file that calls it); dates travel as ISO `YYYY-MM-DD` strings, never as JS `Date` | ADR 0003 |
| Package manager | pnpm 12. Install scripts for `esbuild`, `@parcel/watcher`, `@swc/core`, `sharp` and `unrs-resolver` are off (prebuilt binaries); `sharp` must be turned on when photo processing starts (P3-01) | `pnpm-workspace.yaml`, `CLAUDE.md` |

---

## 4. Working rules

These apply to every task.

1. **Thin slice first.** In each phase, get one path working through database, server and screen, and use it. Then widen it. Never build all the backend and then all the screens.
2. **Check the docs before first use of any library.** Versions move faster than memory. Before writing code against Next.js, Drizzle, the login library, next-intl, MapLibre, pg-boss or the Anthropic SDK, read the current documentation for the installed version. Pin exact versions and commit the lockfile.
3. **Every server action and API route calls the policy module** (`lib/policy`). A route without a permission check doesn't get merged.
4. **Every input is validated on the server with Zod.** Every text field has a maximum length.
5. **Every user-facing string exists in both languages** (`messages/ne.json` and `messages/en.json`). CI fails if a key is missing in either.
6. **Tests go where the risk is:** permissions, matching rules, date conversion, privacy rules (hidden names, exports) and money (AI cost guard). Run the whole suite before finishing a task.
7. **One task, one branch, one pull request.** CI must pass. Read your own diff as a stranger before merging: no debug output, no unrelated changes.
8. **Migrations are forward-only and safe for one release** (add first, remove later). Test each migration on staging before production.
9. **No real names in the repository.** Seeds and tests use invented people. See task `P0-02`.
10. **Record decisions.** A choice that isn't in the spec gets a short file in `docs/adr/`.
11. **Mobile first.** Check every screen at 360 px width before calling it done.
12. **Screens may be built on sample data first, but only within limits.** Public screens follow the design handoff and can be built against `lib/sample/data.ts` before their tables exist, so the design is settled early. The limits:
    - Sample data is invented (no real names, places only as generic as a district or highway), and stays in `lib/sample/`.
    - Components receive data as props or from one data function per page. That way the switch to real queries changes one import, not the markup.
    - The phase task that owns the screen (listed in section 8A) replaces the sample data with real queries. **No page that reaches staging after Phase 1 may import `lib/sample/`.**
    - This does not change rule 1. The thin slice of each phase is still built through database, server and screen first. Sample screens are the target the slice fills in.
13. **Never fake a working control.** If a control needs something not built yet (filters that need MapLibre, a search that needs the database), show it disabled (`disabled` and `aria-disabled`) or leave it out. Never wire it to do nothing silently. Note the task that will enable it in a code comment.
14. **Look at every screen you change.** Run `pnpm screenshot <outDir> <url...>` at 360, 390 and 1440 px, in both languages (`WIDTHS=360,390,1440`), and open every image. The script also reports console errors, failed requests and horizontal overflow; all must be zero.
15. **The design handoff is the source for looks; the spec is the source for behaviour.** Use the handoff README for colours, type, rules, layout and map style. Use the spec for what a screen does and what it may show (privacy rules first). If they conflict, the spec wins; note the difference in the task's status line.

---

## 5. Repository skeleton

The app lives at the root of `NepalRoadMemorial/`, next to `docs/` and `spike/`.

```text
NepalRoadMemorial/
├─ app/
│  ├─ [locale]/                    public pages: page.tsx (home), map/, crash/[slug]/, person/[slug]/,
│  │                               highway/[ref]/, district/[slug]/, remember/, data/, search/,
│  │                               contribute/, about/, methodology/, policies/, transparency/
│  ├─ [locale]/submit/             crash form, tip form, paste-a-link
│  ├─ [locale]/me/                 contributions, memorial dashboards, settings
│  ├─ [locale]/review/             queue and decision screens
│  ├─ [locale]/admin/              users, outlets, settings, audit log, moderation tools
│  └─ api/v1/                      public read-only API; api/health; api/auth
├─ components/                     UI only, no data access (ui/, map/, forms/, review/, memorial/)
├─ lib/
│  ├─ db/                          schema/*.ts, migrations/, queries/, client.ts
│  ├─ domain/                      bs-date.ts, slug.ts, name-key.ts, plate-key.ts, crash-match.ts,
│  │                               person-match.ts, verification.ts, claims.ts
│  ├─ policy/                      can.ts (the only place permissions are decided), matrix.test.ts
│  ├─ workflow/                    submissions.ts, approve.ts, revisions.ts, audit.ts, notifications.ts
│  ├─ pipeline/                    feeds.ts, filter.ts, fetch-article.ts, extract.ts, schema.ts, ground.ts
│  ├─ net/                         safe-fetch.ts (blocks private addresses), rate-limit.ts, turnstile.ts
│  ├─ embeds/                      resolve-link.ts, thumbnails.ts
│  ├─ media/                       process-photo.ts, storage.ts (one interface: disk now, object store later)
│  ├─ stats/                       queries for dashboard, exports, API (one source for all three)
│  └─ i18n/                        config, helpers
├─ worker/                         index.ts, jobs/*.ts, schedule.ts
├─ scripts/                        import-boundaries.ts, import-highways.ts, build-tiles.sh, import-police-stats.ts,
│                                  seed.ts, eval-extraction.ts
├─ messages/                       ne.json, en.json
├─ tests/                          e2e/ (Playwright), fixtures/
├─ infra/                          docker-compose.yml, docker-compose.prod.yml, Caddyfile, Dockerfile.web,
│                                  Dockerfile.worker, backup/, cloudflare.md
├─ docs/                           SPEC.md, PLAN.md, adr/, runbooks/, methodology/
├─ spike/                          feasibility test (scripts only; data files are git-ignored)
├─ .github/                        workflows/ (ci.yml, deploy.yml), ISSUE_TEMPLATE/, dependabot.yml
└─ README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, TRADEMARK.md, LICENSE, DATA_LICENSE,
   CLAUDE.md, .env.example
```

The tree above is the target. **What exists on 13 Nov 2026**, including folders the original tree did not list:

```text
NepalRoadMemorial/
├─ proxy.ts                        language routing (Next 16 name for middleware); CF-IPCountry rule
├─ next.config.ts                  cacheComponents, partialPrefetching, standalone output, cache headers for /map and /tiles
├─ app/
│  ├─ globals.css                  design tokens (Modernist system) and base layer
│  └─ [locale]/
│     ├─ layout.tsx                root layout: fonts, next-intl provider, generateStaticParams for ne/en
│     ├─ page.tsx                  Home (handoff screen 1), sample data
│     ├─ map/page.tsx              Full map (handoff screen 2) and the crash list below it, sample data
│     ├─ not-found.tsx             localised 404
│     └─ [...rest]/page.tsx        sends unknown paths to the localised 404
├─ components/
│  ├─ site/                        site-nav (ink and light tones, phone menu without JS), site-footer,
│  │                               language-switch (client), icons (Lucide-style SVGs)
│  ├─ home/                        hero.tsx (counter, map, latest card, stat strip), sections.tsx
│  └─ map/                         static-map.tsx (server-rendered SVG map + CityLayer), full-map.tsx
├─ lib/
│  ├─ domain/bs-date.ts            + bs-date.test.ts
│  ├─ policy/                      can.ts, matrix.test.ts, coverage.test.ts
│  ├─ i18n/                        routing.ts, request.ts, navigation.ts, messages.test.ts
│  ├─ map/                         style.ts (map palettes and widths), preview-projection.ts, generated/
│  ├─ format.ts                    numbers, Nepali digits, BS/AD date labels for both languages
│  ├─ home/types.ts                home data types (to become query result types)
│  └─ sample/data.ts               invented data for all seven screens (rule 12)
├─ messages/                       ne.json, en.json: keys for all seven screens, identical keys (tested)
├─ scripts/
│  ├─ map/download-sources.sh      boundaries, OSM highways, Kathmandu streets, basemap PMTiles → data/raw, public/tiles
│  ├─ map/build-map-data.ts        → public/map/*.geojson, base-ink.svg, base-light.svg, kathmandu-streets.svg,
│  │                               lib/map/generated/*; stops if the official-border check points fall outside
│  └─ dev/screenshot.mjs           Playwright screenshots + console, request and overflow report
├─ public/map/, public/tiles/      built map layers; the PMTiles file is git-ignored (too large)
├─ data/raw/                       downloaded map sources (git-ignored)
├─ design_handoff_sadak_smriti/    design README, tokens/styles.css, standalone HTML of every screen
├─ docs/                           SPEC.md, PLAN.md, adr/0002-map-sources.md, adr/0003-bs-date-library.md
└─ CLAUDE.md, AGENTS.md, PRODUCT.md
```

Note that the language switch lives in `components/site/`, not `components/ui/` as P0-05 first said. Not present yet: `lib/db/`, `lib/workflow/`, `worker/`, `infra/`, `tests/e2e/`, `.github/`, `README.md`, the licence files and `.env.example`.

---

## 6. Phases at a glance

Estimates are in focused working days for one developer with Claude. The calendar column assumes about 30 focused hours a week; with less time, the weeks stretch but the order doesn't change.

| Phase | Outcome | Days | Weeks |
|---|---|---|---|
| 0. Foundations | Empty bilingual site on staging with login and a map of Nepal's highways | 6 | 1 |
| 1. Crash records | Report → review → public page and map, end to end | 13 | 2–4 |
| 2. News pipeline | Automatic drafts from news, with measured accuracy | 10 | 4–6 |
| 3. Memorials and families | Claims, photos, links, reports, hiding | 10 | 6–8 |
| 4. Research and remembrance | Blackspots, dashboard, downloads, API, remembrance | 9 | 8–10 |
| 5. Hardening and launch | Security review, restore drill, policies, closed beta, launch | 8 + 2 weeks of beta | 10–12+ |

The plan totals 56 working days plus the beta. That fits 12 weeks only with steady full-time effort. If it slips, use the cut list in SPEC section 15.

---

## 7. Things only the owner can do

These involve money, accounts or people, so they can't be done from the code. Each has a deadline, because a task depends on it.

| # | Action | Needed before |
|---|---|---|
| O-1 | Create a GitHub organisation and a **private** repository (it becomes public at launch) | P0-01 |
| O-2 | Buy the Hostinger KVM 2 VPS; confirm the India location is offered at checkout, otherwise choose the nearest Asian location | P0-14 |
| O-3 | Create a free Cloudflare account | P0-14 |
| O-4 | Choose a temporary domain or subdomain for staging | P0-14 |
| O-5 | Create a Google Cloud project and an OAuth client for sign-in | P0-08 |
| O-6 | Create an account with an email service (Resend or Brevo free tier) | P0-08 |
| O-7 | Set up a shared password manager and name a **second admin** who holds every key (SPEC 13.6) | end of phase 0 |
| O-8 | Create an Anthropic API key with a monthly spend limit of $25 | P2-04 |
| O-9 | Write to the main news outlets explaining the project (we link, we never copy text) and ask for a contact | P2-02 |
| O-10 | Create a Telegram bot and a reviewers' group | P2-11 |
| O-11 | Recruit 3–5 reviewers: ideally a journalist, a road-safety person, and someone at ease with Maithili and Bhojpuri names | end of phase 1 |
| O-12 | Label one fresh week of news for the accuracy test (about one day of work; a reviewer can help) | P2-07 |
| O-13 | Collect Nepal Police's published yearly district figures (the documents and their links) | P4-06 |
| O-14 | Check the working name isn't already used; choose the final name; register the `.org.np` and `.org` domains | start of phase 5 |
| O-15 | Find a lawyer or digital-rights group in Nepal to review the privacy, takedown and family-content terms | start of phase 5 |
| O-16 | Open an Open Collective page for donations | P5-10 |

---

## 8. Phase 0: foundations

**Outcome:** you can log in on staging from a phone, switch language, and see a map of Nepal with highways drawn from our own tiles.

- [ ] **P0-01 Create the project.**
  - Files: repository root, `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `README.md`.
  - Do: `git init`; scaffold Next.js with the official `create-next-app` (TypeScript, App Router, Tailwind, ESLint); use `pnpm`; turn on TypeScript strict mode; add Prettier, Vitest and Playwright with one passing test each.
  - Check: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass on a clean clone.
  - **Status: partly done.** Next.js 16.4, TypeScript, Tailwind 4, ESLint, pnpm 12, Vitest and Prettier are installed; `pnpm check` and `pnpm build` pass in the working copy. **Left:** `git init` was run but there are no commits; no `README.md` or `.env.example`; Playwright is installed (used by the screenshot script) but has no test; no Prettier config committed; the check has not been run on a clean clone.

- [ ] **P0-02 Keep real people's data out of the repository.**
  - Files: `.gitignore`, `spike/README.md`.
  - Do: git-ignore `spike/articles/`, `spike/extractions*.json`, `spike/rss_candidates.json`, `spike/viewer.html`, `spike/shots/`, `spike/embeds/shots/`, `spike/embeds/resolved.json`, `spike/.venv/` and `node_modules`. These hold copyrighted article text and real victims' names. Keep the scripts and `SPIKE_RESULTS.md`. Move the ignored data to a private folder outside the repository (`../NepalRoadMemorial-private/eval-data/`), where the evaluation in `P2-07` will read it.
  - Check: `git status` shows none of those files; `git grep` for one victim's name from the test returns only `SPIKE_RESULTS.md` and the spec's examples. Decide then whether those examples should be replaced with invented names before the repository goes public (see `P5-12`).
  - **Status: partly done.** `.gitignore` has every spike path listed above, plus `data/raw/` and the basemap PMTiles. There is no `spike/` folder in this working copy, so the ignore rules are untested. **Left:** confirm where the spike lives, move its data to `../NepalRoadMemorial-private/eval-data/`, then run the `git status` and `git grep` check before the first commit.

- [ ] **P0-03 Open-source files.**
  - Files: `LICENSE` (AGPL-3.0), `DATA_LICENSE` (CC BY 4.0 with the exclusions in SPEC 9.5), `TRADEMARK.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/*`, `CLAUDE.md`.
  - Do: `CLAUDE.md` states what the project is, the commands to run and test it, the layout from section 5, and the working rules from section 4.
  - Check: a new reader can go from clone to a running dev site using only `README.md`.
  - **Status: partly done.** `CLAUDE.md` exists (commands, layout, decisions, rules) and `package.json` says `AGPL-3.0-only`. **Left:** every other file in the list, including `README.md`.

- [x] **P0-04 Local database.**
  - Files: `infra/docker-compose.yml`, `lib/db/client.ts`, `drizzle.config.ts`, first migration.
  - Do: a Postgres + PostGIS container; enable the `postgis`, `pg_trgm` and `unaccent` extensions in the first migration; add `pnpm db:up`, `db:migrate`, `db:studio`.
  - Check: `select postgis_version();` returns a version; migrations run from an empty database with one command.
  - **Status: done (13 Nov 2026).** PostgreSQL 18 + PostGIS 3.6 (`postgis/postgis:18-3.6`) on localhost:5433; roles `migrator`, `app`, `readonly` from `infra/db/init-roles.sh` (SPEC 12.3). The extensions need a superuser, so the init script installs them and migration `0000_extensions` checks they exist (the plan said "enable in the first migration"; a migration running as `migrator` can't). Scripts: `db:up`, `db:down`, `db:reset`, `db:migrate`, `db:generate`, `db:studio`, `db:queries`. Observed: `postgis_version()` = 3.6 after `pnpm db:migrate` on an empty volume; `app` is refused `CREATE TABLE`. Layout and the query registry: ADR 0005, `db/README.md`, `docs/plans/report-a-crash.md`.

- [ ] **P0-05 Languages.**
  - Files: `lib/i18n/*`, `messages/ne.json`, `messages/en.json`, `app/[locale]/layout.tsx`, `components/ui/language-switch.tsx`, a CI script that compares message keys.
  - Do: routes under `/ne` and `/en`; Nepali is the default for visitors from Nepal; self-host one Devanagari and one Latin font, subset.
  - Check: switching language keeps you on the same page; removing a key from one file makes CI fail.
  - **Status: done except CI.** Routes are under `/ne` and `/en`; `proxy.ts` sends Nepal visitors to `/ne`; fonts are Archivo and Noto Sans Devanagari through `next/font` (self-hosted at build time). The switch is `components/site/language-switch.tsx` and keeps the current path. `lib/i18n/messages.test.ts` fails on a missing key, an empty string or a mismatched placeholder. **Left:** the CI half of the check waits for P0-12. Observe the language switch keeping the page on a phone during the Phase 0 exit check.

- [ ] **P0-06 Nepali (BS) dates.**
  - Files: `lib/domain/bs-date.ts`, `lib/domain/bs-date.test.ts`.
  - Do: choose a maintained conversion library after reading its docs; wrap it so the rest of the code never calls it directly. Functions: AD→BS, BS→AD, format in both languages, fiscal year of a date, "same BS day and month" for anniversaries.
  - Check: tests pass for at least 20 known date pairs taken from an official calendar, including the first and last day of several years and of a fiscal year.
  - **Status: nearly done.** `nepali-date-converter` is wrapped in `lib/domain/bs-date.ts` (ADR 0003), with `adToBs`, `bsToAd`, `formatBs`, `formatAd`, `formatBoth`, `fiscalYear`, `isSameBsDayAndMonth`, `todayInNepal` and Nepali-digit helpers. Tests cover 15 known pairs, plus every day from BS 2001 to 2083 against an independent table (`nepali-datetime`). **Left:** add 5 more pairs from an official calendar, including last days of years, to reach the 20 the check asks for. The 2084 tripwire stays (ADR 0003).

- [ ] **P0-07 Places.**
  - Files: `lib/db/schema/places.ts`, `scripts/import-boundaries.ts`, `docs/adr/0002-map-sources.md` (already written; extend it).
  - Do: find the official open dataset of provinces, districts and local units with Nepali and English names and boundaries; record its source and licence in the ADR; import it; fill `place_aliases` with common spellings (start from `spike/dedupe.py`).
  - Check: the tables hold 7 provinces, 77 districts and 753 local units; a point in Kathmandu resolves to the right local unit with one query.
  - Stop and ask if no dataset with a clear open licence can be found.
  - **Status: imported and checked (13 Nov 2026); only `place_aliases` is left.** Files differ from the list above: `lib/db/schema/places.ts`, `lib/places/match.ts` (+ tests), `scripts/db/import-places.ts` (`pnpm db:places`), `scripts/db/download-place-names.sh` (`pnpm db:places:download`), queries in `lib/db/queries/places.ts` (snapshots in `db/queries/places/`). Boundaries: Open Knowledge Nepal (CC BY 4.0). Names: `sagautam5/local-states-nepal` (MIT), matched per district; 166 non-exact matches listed for review in `docs/data/place-name-matches.csv`; 755 vs 753 reconciled (ADR 0002). Observed: 7 / 77 / 753 rows, official type counts, valid geometry; one query resolves central Kathmandu to Kathmandu, Gunji to Byas (Darchula), and a point in India to nothing; re-running the import changes no counts. **Left:** `place_aliases` with both spellings of every non-exact match plus the spike's variants, and fixes for the dataset's English typos.

- [ ] **P0-08 Login and roles.**
  - Files: `lib/auth/*`, `app/api/auth/*`, `lib/db/schema/users.ts`, `app/[locale]/login/`.
  - Do: Google sign-in and email magic link (confirm the library choice against current docs: Better Auth, with Auth.js as the fallback); roles on the user; two-factor required for reviewers and admins; a local mail catcher container for development; a script to make the first admin.
  - Check: on a phone, sign in both ways; a reviewer account without two-factor is forced to set it up before seeing `/review`.
  - **Status: built (14 Nov 2026), waiting on O-5 for a real Google sign-in.** Owner's changes: Google only, no magic link, so O-6 and the mail catcher are not needed; roles are changed only by `pnpm users:role` on the server and the database refuses role writes from the website (migration 0005, ADR 0006). Files: `lib/auth/{server,session,actor}.ts`, `lib/db/auth-adapter.ts`, `lib/db/schema/auth.ts`, `app/api/auth/[...all]/`, `app/[locale]/{login,account,account/two-factor,review}/`. Checked: unit tests for the staff check, database tests for role writes and code attempts, and a browser run of visitor → contributor → `users:role` → admin (wrong code refused, right code opens `/review`) → sign out, 20/20. **Not checked:** the Google step itself, which needs the OAuth client (O-5). **Left:** a reset for a staff member who lost their phone and backup codes.
  - **Accounts page (14 Nov 2026):** `/admin/users`, role changes and deactivation as described in ADR 0006 ("Managing accounts"), `components/review/staff-nav.tsx` with Sign out on the staff pages. Checked: policy tests, 21 database tests for the two functions and their privileges, and a browser run (admin, reviewer, contributor, deactivated user, sign-out, Nepali at 390 px), 20/20 on a production build.
  - Was: waits on O-5 and O-6. The login page must use the shared site header and footer and the handoff's form style (square inputs, 44 px targets), even though the handoff has no login screen.

- [x] **P0-09 Permissions.**
  - Files: `lib/policy/can.ts`, `lib/policy/matrix.test.ts`.
  - Do: one function `can(user, action, resource)`; encode every row of the matrix in SPEC 4.2 as data, and test every cell.
  - Check: the test file has one case per cell of the matrix, all passing; a test also scans `app/` and fails if a server action or API route doesn't call the policy.
  - **Status: done (13 Nov 2026).** `can()` holds SPEC 4.2 as data, covering the roles, the two-factor requirement for reviewer powers, guardian rights and bans. `matrix.test.ts` checks every cell against an independent copy. `coverage.test.ts` scans `app/` for `route.ts` files and `"use server"` files that never call the policy; its exemption list is empty. All pass in `pnpm check`. There are no routes or actions yet, so the coverage test starts to matter in P0-08.

- [ ] **P0-10 History and audit.**
  - Files: `lib/workflow/revisions.ts`, `lib/workflow/audit.ts`, schema for `revisions` and `audit_log`, database roles in a migration.
  - Do: helpers that every later write uses; the app's database role may only insert into `audit_log`.
  - Check: an attempt to update or delete an audit row as the app role fails with a permission error.
  - **Status: not started.** Needs P0-04.

- [ ] **P0-11 Highways and map tiles.**
  - Files: `scripts/import-highways.ts`, `scripts/build-tiles.sh`, `lib/db/schema/roads.ts`, `components/map/base-map.tsx`.
  - Do: download the Nepal OpenStreetMap extract; import numbered national highways; join each into one line; cut into 1 km segments with stable IDs (SPEC 9.3); build one PMTiles file for the base map; a map component that loads only when a map is on screen.
  - Check: the map page shows Nepal with highways from our own file and no third-party tile requests in the network tab; `select ref, round(length_km) from highways` looks right for three highways you know.
  - **Status: the file half is done; the database half is not.**
    - Done: `scripts/map/download-sources.sh` (`pnpm map:download`, needs Docker) fetches the boundaries, OSM highways with `ref=NH..` through Overpass, Kathmandu streets, and a Protomaps basemap cut to Nepal (`public/tiles/nepal-basemap.pmtiles`, about 330 MB, git-ignored).
    - Done: `scripts/map/build-map-data.ts` (`pnpm map:build`) normalises refs to `NH01`–`NH80`, drops Indian and local codes, and writes `public/map/highways.geojson`, the boundary files, the outside-Nepal mask, the pre-rendered base layers `base-ink.svg` and `base-light.svg`, the faded-city layer `kathmandu-streets.svg`, and `lib/map/generated/highway-paths.json` for the static map. It stops if the official-border check points fall outside Nepal.
    - Done: `/map` exists and shows Nepal with highways from our own files and no third-party requests. It uses the static renderer for now (P0-18), not MapLibre.
    - `maplibre-gl` 6.18 and `pmtiles` 4.5 are installed but not used yet.
    - **Left:** `scripts/import-highways.ts` into PostGIS (needs P0-04); one line per highway; 1 km segments with stable IDs; `lib/db/schema/roads.ts`; `components/map/base-map.tsx` (MapLibre, loaded only when on screen); `scripts/build-tiles.sh` if our own highway tiles are still needed beside the GeoJSON; the SQL length check.
    - Before drawing in-map Nepali labels, test the Protomaps pre-shaped Devanagari font (ADR 0002). Fall back to HTML labels if it doesn't render correctly.

- [ ] **P0-12 Continuous integration.**
  - Files: `.github/workflows/ci.yml`, `.github/dependabot.yml`.
  - Do: on every pull request run lint, type check, unit tests, the message-key check, a build, and Playwright against a seeded database; enable CodeQL and secret scanning.
  - Check: a pull request with a failing test can't be merged.
  - **Status: not started.** Waits on O-1. `pnpm check` is the command CI should run first; add `pnpm build` and the Playwright suite after it.

- [ ] **P0-13 Containers.**
  - Files: `infra/Dockerfile.web`, `infra/Dockerfile.worker`, `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `app/api/health/route.ts`.
  - Do: Next.js standalone build; the health route checks the database; images are built in CI and pushed to the GitHub registry.
  - Check: `docker compose -f infra/docker-compose.prod.yml up` on your own machine serves the site.
  - **Status: not started.** `output: "standalone"` is already set. The basemap PMTiles (about 330 MB) is not in git. Decide whether the image downloads it at build time or Caddy serves it from a volume, and write the choice in the runbook.

- [ ] **P0-14 Server and staging.**
  - Files: `docs/runbooks/server-setup.md`, `infra/cloudflare.md`, `.github/workflows/deploy.yml`.
  - Do: harden the VPS exactly as SPEC 12.4 (key-only SSH, firewall open to Cloudflare only on 80/443, automatic security updates, non-root deploy user); Cloudflare in strict TLS mode with an origin certificate; deploy staging automatically from `main`; production by manual approval; write every step into the runbook as you go.
  - Check: staging opens over HTTPS on a phone; a direct request to the server's IP address is refused; the database port isn't reachable from outside.
  - **Status: not started.** Waits on O-2, O-3 and O-4. Cloudflare must pass `CF-IPCountry` through; the language rule in `proxy.ts` depends on it.

- [ ] **P0-15 Backups and monitoring.**
  - Files: `infra/backup/*`, `docs/runbooks/restore.md`.
  - Do: nightly encrypted backup of the database and media to an off-site bucket; an uptime check; a disk alert at 80%; error reporting.
  - Check: restore last night's backup into a scratch database and count the rows; stop the web container and receive the alert.
  - **Status: not started.**

- [ ] **P0-16 Decision records.**
  - Files: `docs/adr/0001-…` onward.
  - Do: one short file per row of SPEC section 2.
  - Check: every row has a file.
  - **Status: started.** `0002-map-sources.md` and `0003-bs-date-library.md` exist. **Left:** `0001` and one file per row of SPEC section 2. Also add ADRs for the decisions in section 3's second table that have none yet: the Modernist visual design (and why it replaced the Toposheet), the two-renderer map, and sample-data-first screens (rule 12).

- [ ] **P0-17 Design system and site shell.** *(Added in version 1.1. Unticked only because the contrast check is open.)*
  - Files: `app/globals.css`, `app/[locale]/layout.tsx`, `components/site/*`, `app/[locale]/not-found.tsx`, `app/[locale]/[...rest]/page.tsx`, `lib/format.ts`.
  - Do: the tokens from the handoff README (colours, neutral and accent ramps, square corners, `--shadow-lg`, type scale, spacing, 32/16 px gutters); Archivo and Noto Sans Devanagari; the nav in two tones (68 px ink on Home, 64 px light on inner pages with the active link underlined 2px, 56 px phone header with a menu that works without JavaScript); the footer; the localised 404; number and date formatting in both scripts (Indian digit grouping, Nepali digits, BS and AD labels).
  - Check: every token in the README table is in `globals.css`; text colours meet 4.5:1 on their grounds; the nav and footer render at 360 and 1440 px in both languages with no overflow; `/en/xyz` returns a localised 404.
  - **Status: built (13 Nov 2026), one check open.** The colour tokens, both ramps and `--shadow-lg` are in `globals.css`. The shell was checked by screenshot at 360, 390 and 1440 px in both languages, and `/en/xyz` returns 404. **Open:** the contrast ratios of the Modernist palette have not been measured. Measure them (an automated check is enough) before P5-04.

- [x] **P0-18 Static map renders.** *(Added in version 1.1.)*
  - Files: `components/map/static-map.tsx`, `lib/map/style.ts`, `lib/map/preview-projection.ts`, `lib/map/generated/*`, `public/map/base-*.svg`, `public/map/kathmandu-streets.svg`.
  - Do: a server-rendered SVG map with no map JavaScript (SPEC 6.2), in the ink and light tones. It has these layers: graticule, pre-rendered base (land, official border, every highway), highways coloured by killed per km, a selected highway with a halo (others fade to 40%), crash dots sized `3 + 2.6·√killed` (hollow when the place is approximate), latest-crash rings and a label chip, city labels and peaks. It can crop to a view (centre and span) for small maps on inner pages. The faded Kathmandu street layer sits at the right edge. All colours and widths come from `lib/map/style.ts`, which the MapLibre map will also use.
  - Check: the home hero and `/map` show the map at 360 and 1440 px with line widths that stay constant when cropped or enlarged; no requests to any third-party host.
  - **Status: done (13 Nov 2026).** Used by the Home hero and the Full map. The small maps for the Crash and Highway pages will use the same component with `tone="light"` and `view`.

**Phase 0 exit check:** the outcome at the top of this section, observed on a real phone.

---

## 8A. UI track: the seven handoff screens

*(Added in version 1.1.)* The design handoff defines seven public screens, each at 390 px and 1440 px. They are built on sample data (rule 12) so the look is settled before the data exists. Each screen is then **wired** to real data by the phase task that owns its behaviour. A screen counts as finished only when it is wired.

**How to build a screen (every UI task)**

1. Read the screen's section in the handoff README, the matching SPEC section, and open `Sadak Smriti Final (standalone).html` to see it at both sizes.
2. Use the strings already in `messages/{en,ne}.json` (every screen has a namespace: `Home`, `Map`, `Crash`, `Person`, `Highway`, `Data`, `Report`). Add any missing key to both files.
3. Take data from `lib/sample/data.ts` through one function per page. Don't scatter sample imports through components.
4. Build the phone layout and the desktop layout. The handoff often shows different content order on phones; follow it.
5. Apply the SPEC privacy rules even on sample data: hidden names show as "Name withheld" tiles, injured children appear without names, and injured people's pages get `noindex`.
6. Every page renders `<SiteNav current="…" />` and `<SiteFooter />` from `components/site/`, including the 404 page. **There is one header for the whole site** (owner's decision, 13 Nov 2026): the dark Home bar. The handoff's separate light header for inner pages is not used. Don't build a page-specific header; `lib/i18n/nav.test.ts` enforces both.
7. Disable controls that need unbuilt features (rule 13).
8. Run `pnpm check` and take screenshots at 360, 390 and 1440 px in both languages (rule 14). Open every image.

| ID | Screen (route) | Handoff section | Sample data | SPEC | Built | Wired by |
|---|---|---|---|---|---|---|
| UI-01 | Home (`/`) | 1 | `HOME_STATS`, `CRASHES`, `LATEST`, `REMEMBERED`, `NEWS`, `POLICE_*`, `HIGHWAY_RISK` | 6.2 | **Built** | P1-08 (counter, latest, this week, news), P4-06 (police), P4-08 (remembered today) |
| UI-02 | Full map (`/map`) | 2 | `CRASHES`, `HIGHWAY_DETAIL`, `CRASH_DETAIL`, `WEEKLY_KILLED` | 6.3 | **Built (static)** | P1-09 |
| UI-03 | Crash (`/crash/[slug]`) | 3–7 "Crash" | `CRASH_DETAIL` | 6.4 | **Built** | P1-08 |
| UI-04 | Person / memorial (`/person/[slug]`) | 3–7 "Person" | `PERSON_DETAIL` | 6.5 | **Built** | P1-08 (basic), P3-05 (full) |
| UI-05 | Highway (`/highway/[ref]`) | 3–7 "Highway" | `HIGHWAY_DETAIL` | 6.6 | **Built** | P4-03 |
| UI-06 | Research dashboard (`/data`) | 3–7 "Research dashboard" | `DASHBOARD` | 9.2 | **Built** | P4-04 |
| UI-07 | Report a crash (`/submit`) | 3–7 "Report a crash" | `CRASHES` (duplicate panel) | 7.1 | **Built** (see `docs/plans/report-a-crash.md`) | P1-04 (thin form), P1-05, P1-06 |
| UI-08 | Contribute (`/contribute`, `/contribute/[handle]`) | none (owner's request, 14 Nov 2026) | `content/contributors.json` (real content, not sample data) | 6.1 | **Built** | stays as is; P4-09 adds the other explaining pages |

- [ ] **UI-01 Home.** *(Built on sample data; ticked when wired.)*
  - Files: `app/[locale]/page.tsx`, `components/home/{hero,sections}.tsx`.
  - Built: the ink nav; the 720 px ink hero with the counter ("recorded since 1 Baisakh 2083"), the static map, a zoom rail drawn as a picture (not buttons), the "Latest" card, "Tap the map to expand", and the 5-cell stat strip. The whole map links to `/map`. Below it: Remembered today, This week (timeline), In the news ("we never copy article text"), Police statistics with coverage bars and Police reports, the two ink CTAs, and the footer. The phone layout follows the handoff: a 76 px counter, a 250 px map with an "Expand map" chip, a horizontally scrolling stat strip, then the sections as lists.
  - Checked: screenshots at 360, 390 and 1440 px in both languages; no overflow or console errors.
  - Left for wiring: see the table above. The "2 hours ago" label in the Latest card is a fixed sample value and must be computed from the crash time.

- [ ] **UI-02 Full map (static).** *(Built on sample data; ticked when wired in P1-09.)*
  - Files: `app/[locale]/map/page.tsx`, `components/map/full-map.tsx`.
  - Built, desktop: the full-screen ink map with NH17 selected; the shared ink site nav (68 px, "Map" underlined, brand, links, search, language switch, "Report a crash") above it, and under the nav a floating filter bar inside the map (the four filters shown disabled, "List view"); the 360 px highway panel (red header, 3 stats, worst 5 km stretches, "Open highway page →"); the zoom rail on the right; the 104 px time scrubber with weekly bars (the current week in red-500) and BS month labels.
  - **Deviation from the handoff (owner's decision, 13 Nov 2026):** the handoff draws the Full map with its own floating top bar and a "✕ Close map" button, and no site nav. The owner asked for the same header as Home on `/map`, so the page uses `SiteNav` and the map fills the space below it (`100dvh` minus 68 px on desktop, 56 px on phones). The brand, language switch and close button come from the nav; the filters and "List view" stay inside the map. The phone menu opens over the map (the nav is `relative z-40`).
  - Built, phone: the 56 px ink nav with its menu, then a full-screen map with a search field (display only) and a disabled filter button; a 470 px bottom sheet with the latest crash (date and time, title, place, killed/injured/on board, 7-per-row face tiles with an empty tile for the unnamed, the named summary) and a pinned "Full crash page →".
  - Built, both sizes: a plain list of crashes under the map (`#list`). It is the list alternative the README requires, and works with no map at all. The official-border note and the attribution sit under the list.
  - Checked: screenshots at 360, 390 and 1440 px in both languages; `pnpm build` prerenders `/ne/map` and `/en/map`.
  - Not built (P1-09): MapLibre, filters, the draggable scrubber, tapping a highway or a dot, bottom-sheet snapping, search, and a real List view toggle.

- [ ] **UI-03 Crash page.** *(Built on sample data, 13 Nov 2026; ticked when wired in P1-08.)* Desktop: a header grid with the title block and three counts (Killed at 72 px red, Injured, On board). Main column: people killed as 4-column cards (a hidden name is an empty "Name withheld at the family's request" tile), the injured, "Where reports disagree" (claims as linked boxes, the published one filled ink), and a sources table. A 420 px right column: a small light map (`StaticMap tone="light" view=…`), place, vehicle, stated causes with attribution, actions. Phone: keep the map as a 200 px strip under the counts, then place, the disagreement bar, people, sources and actions. Check: rule 14, and the hidden-name tile shows no name anywhere in the HTML.
  - **Status: built (13 Nov 2026).**
    - Files: `app/[locale]/crash/[slug]/page.tsx`, `components/crash/crash-view.tsx`. `StaticMap` gained a crop helper, `pxPerUnitForSpan` in `lib/map/preview-projection.ts`, so small cropped maps get correctly sized dots and lines.
    - Every sample crash has a page (`generateStaticParams`; an unknown slug returns 404). Only the latest sample crash has people, disagreements and sources. The others show header, counts, map, place and vehicle, and say the rest is not in the sample data yet.
    - People tiles: a named person links to `/person/[slug]`; a hidden name is a "Name withheld at the family's request" tile; a person not yet named is a dashed tile. Neither of the last two has a link or any name text. The sample now includes one withheld person (9 killed = 7 named + 1 not yet named + 1 withheld). The injured child shows as "Name hidden".
    - Checked: `pnpm check` (135 tests); screenshots taken at 360, 390 and 1440 px in both languages with no console errors, failed requests or overflow reported; `pnpm build` prerenders every sample crash in both languages (31 static pages in all). **Opened and looked at:** English at 1440 px (full page), Nepali at 360 px (full page), and the crash without detail at 360 px. The other captures were checked only through the script's report. Open the Nepali 1440 px and the 390 px captures before calling this wired.
    - Controls shown disabled (rule 13), enabled by P1-12: Suggest a correction, Add a news link, Add a person, Report. Source rows have no outbound links because the sample has no URLs; real rows link to the article (open question: `rel="noopener noreferrer"` and no referrer, SPEC 12.2).
    - **Left:** the "Where reports disagree" rows are static (the "3 claims" label does not expand); the "Show all N" sources and "All N and the injured" links go nowhere yet; "Last updated" is a fixed sample value; the hidden-name test (a name appears nowhere in the HTML) needs real hidden data and belongs to P1-08.

- [ ] **UI-04 Person / memorial page.** *(Built on sample data, 13 Nov 2026, with the new `/remember` page; ticked when wired in P1-08 / P3-05.)* Desktop: a 520 px greyscale cover photo (or striped placeholder with a soft initial) and the identity block (tags "Killed" and "✓ Confirmed by family", name 64/800, Devanagari name 30 px, alias, age, hometown, the crash link, the candle button with its count). Below it: the story at 19 px, the photo grid, click-to-load embed cards ("TAP TO LOAD", no platform requests before a tap), and tributes. Right rail: facts, the crash, "What the news said" spellings, family actions. Also build the simpler injured-person variant with `noindex`. Check: rule 14; the embed cards make no third-party requests in the screenshot run.

  - **Status: built (13 Nov 2026).** Files: `app/[locale]/person/[slug]/page.tsx`, `components/person/person-view.tsx`, and a new remembrance page `app/[locale]/remember/page.tsx` with `components/remember/carousel.tsx`.
    - `/remember` (owner's request): one section per crash, newest first: the date in BS, an "N years ago today" tag on anniversaries, the headline linking to the crash page, and a swipeable carousel of the people killed, each card linking to their memorial page. People not yet named and names withheld are counted on a plain card, never named. The carousel scrolls with CSS alone; its arrow buttons appear only with JavaScript. This differs from SPEC 6.7 (anniversaries today, then this week, filterable by district); P4-08 should add the "today / this week" grouping and the district filter on top of this layout.
    - Person page: cover (striped placeholder with a soft initial), tags, name in both scripts, alias, age, hometown, crash link, candle count, story, photo grid, tributes, "Who they were", the crash, "What the news said". Only one sample person has a family-written page; the rest say their story hasn't been written yet. Disabled until their tasks exist: Light a candle (P3-06), Share, Report (P3-07), Write a tribute (P3-06), I am family (P3-02), Add a memory. Videos and posts are left out until click-to-load embeds exist (P3-04). "Who she was" became the neutral "Who they were" for everyone.
    - Sample data: three past crashes (`MEMORIAL_CRASHES`, all on 27 Kartik) and 14 invented people (`VICTIMS`); `ALL_CRASHES` lets the crash page open them.
    - Checked: screenshots at 360 and 1440 px in both languages (no errors; a desktop overflow from the carousel was fixed); clicking a person and a headline lands on the right pages; `pnpm build` prerenders `/remember` and every person page in both languages.

- [ ] **UI-05 Highway page.** *(Built on sample data, 13 Nov 2026; ticked when wired in P4-03.)* A header with 4 stats and a cropped light map; a full-width chart of killed per 1 km segment (174 bars for NH17, blackspots in red); the top 10 blackspots table; charts by vehicle and by time of day; deaths by month; recent crashes. Follow the `dataviz` skill for the charts, and put a table behind each chart for screen readers. Check: rule 14; the segment chart reads correctly at 360 px (scrolls inside its own box or shrinks, never overflows the page).

  - **Status: built (13 Nov 2026).** Files: `app/[locale]/highway/[ref]/page.tsx` (`/highway/NH17`; the full map's "Open highway page →" now lands here), `components/charts/charts.tsx` (server-rendered SVG: `Columns`, `HBars`, `ChartData`). Follows the `dataviz` method within the design system: single-series charts with no legend box, square bar ends (the handoff never rounds corners), a hover label on a full-height hit area for every bar, a table view and a working CSV download (a `data:` link, no JavaScript) under each chart. Per-km colours validated with the dataviz script: neutral-600 `#7d7979` with accent `#ec3013` (CVD ΔE 13.1, normal ΔE 22.3, contrast ≥ 3:1; its only "fail" is that grey has no hue, which is intended). On phones the 174-bar chart keeps a 720 px width and scrolls inside its own box. The sample per-km data was made consistent with the top-10 table (whole numbers; the top 10 are the 10 tallest). Checked: screenshots at 360 and 1440 px in both languages; `pnpm build` prerenders `/ne/highway/NH17` and `/en/highway/NH17`. **Left for P4-03:** real data and every highway; the district page; richer tooltips if the native ones prove too slow on phones.

- [ ] **UI-06 Research dashboard.** *(Built on sample data, 14 Nov 2026; ticked when wired in P4-02 / P4-04.)* A 280 px filter rail (period, province, district, highway, vehicle, crash type, natural-hazard checkbox, downloads with file sizes); a 5-cell KPI row; a line chart of killed and crashes by month with a dashed police average; horizontal bars by province, vehicle, crash type and road user; time of day, an age/sex pyramid and police coverage. Every chart has "CSV ↓" and a table alternative. On phones the filter rail becomes a sheet. Filters stay disabled until P4-04. Check: rule 14; every chart can be reached by keyboard.

- [ ] **UI-07 Report a crash.** **Superseded by [`docs/plans/report-a-crash.md`](plans/report-a-crash.md)** (owner's decisions, 13 Nov 2026): one short page, no login, flood limits, and the first real database tables. The handoff description below is kept for reference only. The "paste a news link" bar; a 5-step header (the current step filled ink); step 2 with selects and a map pin; the red-100 "Is it one of these?" panel with duplicate cards and "Yes, add to this crash". Phone: a progress bar, vehicle chips (selected = ink fill), and 44 px −/+ steppers. The form posts nothing until P1-04 (submit disabled, rule 13). Check: rule 14; every field is labelled in both languages.

- **Status, UI-06 (built 14 Nov 2026).** Files: `app/[locale]/data/page.tsx`, `components/charts/{charts,choropleth}.tsx`, `lib/places/districts.ts`, and `scripts/map/build-map-data.ts` (now also writes `lib/map/generated/district-paths.json`, 28 KB).
  - **Beyond the handoff**, as the owner asked ("detailed, with a few more charts"): a district choropleth (5 quantile classes on one hue, with a legend and a "most deaths" ranking), day of week, stated causes (labelled as reports, not findings of fault), deaths per crash, and deadliest highways per 100 km. Plus the handoff's KPIs, the month line chart (killed, crashes, dashed police average), provinces, vehicle type, crash type, road user, time of day, the age and sex pyramid, police coverage, and a "what these numbers leave out" note (SPEC 9.1).
  - Every chart has a hover label per bar, a table view and a CSV download. Every breakdown of the sample sums to the KPIs (1,184 killed, 846 crashes).
  - Filters and downloads are **disabled**, with a notice, until real records exist (rule 13).
  - Colours were checked with the `dataviz` validator: red against ink (delta E 27 or more) and ink against grey (34) pass the contrast and colour-blindness checks; its only flags are "no hue", which is intended on this palette.
  - **Shared district names:** the map build and the database import now take district names and slugs from `lib/places/districts.ts`, so map links and database rows agree. The map's district files changed as a result (Achham, Panchthar, Parbat and Ramechhap are now spelled correctly, and districts have Nepali names). Verified: the other map outputs are byte-identical after the change.
  - **Left for P4-02 and P4-04:** real queries from one `lib/stats`; working filters and the "include natural hazards" switch; real file sizes; the SPEC 9.2 "top 20 blackspots" and "platform versus police" by district (the sample compares provinces); and a tap-friendly alternative to the native hover labels, which don't appear on touch screens (the tables cover that for now).

- [x] **UI-08 Contribute.** *(Added 14 Nov 2026 at the owner's request. Unlike the screens above it uses real content, not sample data, so it is complete once real contributors are added.)* Files: `app/[locale]/contribute/page.tsx`, `app/[locale]/contribute/[handle]/page.tsx`, `components/contribute/{contributor-card,share-card}.tsx`, `lib/contributors/*`, `lib/site-links.ts`, `content/contributors.json`, `content/README.md`, `scripts/contributors/fetch-avatars.ts`.
  - **Page:** four ways to help (report a crash, become a reviewer, write code or translate, donate), then "the people behind it" in three groups (code and design; reviewers and volunteers; donors). Each person has a photo, name in both scripts, roles and their own GitHub, LinkedIn and website links. Listing is **opt-in** by pull request (SPEC 10.5: credit only if chosen). Donors can be named or counted anonymously, and **amounts are never published**.
  - **Links not set up yet** (`lib/site-links.ts`): the repository, a reviewer contact address and the donation page show "Opens soon" instead of a dead link until the owner fills them in (section 7: O-1, O-16).
  - **Photos (decision):** the site loads images only from its own server (SPEC 12.2), so a photo is a file in `public/contributors/`. `pnpm contributors:avatars` saves a contributor's public GitHub avatar once. **LinkedIn photos cannot be used**: LinkedIn doesn't allow its images to be loaded or copied by other sites, and its profile pages can't be read automatically. People without GitHub send a photo file with their pull request. Photos show in black and white (design rule 4); with none, the initial appears on a striped tile.
  - **Share cards:** each contributor's page makes a 1080x1920 story and a 1080x1080 post, in the style of a year-in-review card: photo, name in both scripts, roles, big numbers, the map of Nepal, a tagline and the address. They are **drawn in the visitor's browser, not on the server**, because Next's image generator (Satori) cannot join Devanagari letters, while the browser shapes Nepali correctly with the site's own fonts. Nothing is uploaded. "Share" opens the phone's share sheet with the image (Instagram, WhatsApp, Facebook and so on) where the browser supports sharing files, and otherwise downloads it; "Copy link" copies the page address. Checked by saving the generated images in both languages and opening them. This differs from SPEC 6.8 and P4-08, which plan a server-made card for a memorial; that card has the same Nepali-text problem and can reuse this method.
  - **Validated content:** `lib/contributors/contributors.test.ts` checks `content/contributors.json` (unique handles, https links, LinkedIn profile links only, photo files exist, no hotlinked photos), so a bad entry fails `pnpm check` with the field named.
  - **Sample entries:** five invented people marked "Sample", with the GitHub mascot as one photo, show the layout. Delete them when real people are added.
  - **Checked:** screenshots at 360 and 1440 px in both languages and the profile at 390 px, with no errors or overflow; `pnpm build` prerenders both pages for every contributor.
  - **Left:** a way to send a photo other than a pull request (needs P0-08 login and P3-01 photo handling); a per-person contributions feed once the database records who did what (P1-13); and the `/about`, `/transparency` and donation pages that "ways to help" will link to (P4-09, P5-10).

**Order.** UI-01 to UI-07 are built on sample data and UI-08 uses real content. What remains is wiring the screens to real data, in the order of the phase tasks in the table above. UI work can run alongside Phase 0 infrastructure tasks, but must never delay P0-04, P0-08 or the Phase 1 thin slice.

---

## 9. Phase 1: crash records, end to end

**Outcome:** a contributor submits a crash on a phone; it appears in the queue; a reviewer approves it on a phone; it shows on the map and its own page within a minute.

- [ ] **P1-01 Core tables.**
  - Files: `lib/db/schema/{crashes,persons,sources,claims,workflow}.ts`, migrations.
  - Do: the tables in SPEC 10.2 to 10.5 that this phase needs (crashes, vehicles, causes, persons, sources, crash_sources, claims, person_mentions, submissions, reviews, slug_redirects, notifications, settings), with every constraint and index in SPEC 10.7.
  - Check: constraint tests: a negative death count, a future date, and a second review by the same reviewer are all rejected by the database.

- [ ] **P1-02 Matching and naming rules.**
  - Files: `lib/domain/{name-key,plate-key,slug,verification,claims}.ts` with tests.
  - Do: port `phon`, `given_key`, `plate_key` from `spike/dedupe.py`; slugs from BS date, place and vehicle; the verification level; choosing the published value from claims.
  - Check: the tests reuse the spike's hard cases with invented names of the same shape: a doubled-letter spelling matches, a "kumari" suffix is ignored, and a Devanagari plate equals its English form.

- [ ] **P1-03 Invented seed data.**
  - Files: `scripts/seed.ts`.
  - Do: about 30 invented crashes across provinces, modelled on the spike's shapes (many sources, disagreeing tolls, unnamed dead, hidden names, an injured child).
  - Check: `pnpm db:seed` on an empty database gives a browsable site.

- [ ] **P1-04 Thin slice.**
  - Files: `app/[locale]/submit/page.tsx`, `lib/workflow/{submissions,approve}.ts`, `app/[locale]/review/`, `app/[locale]/crash/[slug]/page.tsx`.
  - Do: the smallest form (date, district, deaths, one source link) → a draft crash and a submission → a plain queue → approve → a plain public page. Every write goes through policy, validation, revision and audit.
  - Check: do it by hand on staging from a phone; see the submission, review, revision and audit rows in the database.

- [ ] **P1-05 The full report form.**
  - Files: `components/forms/crash-wizard/*`, `components/forms/bs-date-picker.tsx`, `components/map/pin-picker.tsx`.
  - Do: the five steps in SPEC 7.1; a date picker in BS or AD; a pin on the map or a place chosen from lists; vehicles, people and sources; autosave on the device; every validation rule in SPEC 7.1.
  - Check: fill the form on a phone with the network switched off halfway, reload, and continue from the saved draft; a pin outside Nepal is refused with a clear message.
  - Design: UI-07 (handoff "Report a crash"). Turn on the controls UI-07 left disabled. The pin picker uses MapLibre and the style from `lib/map/style.ts` in the light tone, and tests "inside Nepal" against our official border (`public/map/nepal.geojson` or the database), never OSM's.

- [ ] **P1-06 Duplicate warning.**
  - Files: `lib/domain/crash-match.ts`, `app/[locale]/submit/similar/route.ts`, `components/forms/similar-crashes.tsx`.
  - Do: once date and district are known, show crashes within ±2 days in that district, plus any plate match, **including unreviewed drafts**; choosing one switches the form to "add a source or correction".
  - Check: entering a seeded crash's date and district shows it; choosing it creates an add-source submission, not a new crash.

- [ ] **P1-07 Review queue and decision screen.** *(Staff crash and person editor added 14 Nov 2026, ADR 0008: `/review/crashes`, `lib/workflow/edit-crash.ts`, `lib/forms/crash-edit.ts`, the `persons` table and the history with restore. Checked: 58 form tests, 20 database tests, a 25-step browser run on a production build.)* *(Started 14 Nov 2026, ADR 0008: `/review/submissions` and the decision screen for visitor reports and additions, `lib/workflow/decide.ts`, `lib/db/queries/submissions.ts`, the `reviews` table. Checked: 22 database tests on the real report path, a 21-step browser run on a production build. Left: edit-and-approve, the reporter's contact for reviewers, keyboard shortcuts, the other tabs, the version check for edits.)*
  - Files: `app/[locale]/review/*`, `components/review/*`, `lib/workflow/approve.ts`.
  - Do: the tabs, flags and sorting in SPEC 7.4; the decision screen with changed fields highlighted and each field's source; approve, edit and approve, request changes, reject with a reason; the two-approval list; the block on approving your own work; the version check for edit conflicts; keyboard shortcuts.
  - Check: automated tests for each two-approval rule, for self-approval being refused, and for a stale submission showing the new difference; a manual pass on a phone.

- [ ] **P1-08 Public pages.**
  - Files: `app/[locale]/page.tsx`, `crash/[slug]/`, `person/[slug]/`, `components/ui/*`.
  - Do: the home page with the "recorded since" counter and recent crashes; the full crash page with disagreements, "not yet named" and the verification badge; a basic person page. Apply the privacy rules now: hidden names, injured children hidden by default, `noindex` on injured people's pages, old slugs redirecting.
  - Check: tests prove a hidden name appears nowhere in the HTML of the crash page, the person page, search, or the sitemap; an injured child's name is absent unless switched on.
  - **Status codes and redirects (found 13 Nov 2026):** with Cache Components, a dynamic page that calls `notFound()` inside `<Suspense>` has already started streaming, so an unknown slug returns **200** with the not-found UI and a `noindex` tag (documented in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`), and a `redirect()` there becomes a client-side redirect. `dynamicParams` is not available with Cache Components. For real data, old slugs must answer with a permanent HTTP redirect (SPEC 10.7), so look up slugs and `slug_redirects` **before** streaming starts (in `proxy.ts`, or a page without a Suspense boundary above the lookup), and check the status codes with curl.
  - Design and wiring: the Home page (UI-01) already exists on sample data. Replace its sample imports with queries, compute "recorded since", the counter and the "hours ago" label from real data, and make every section show an empty state when there is nothing to show (no crashes yet). Build the Crash page from UI-03 and the basic person page from UI-04. Decide what happens to `pnpm dev:sample` and the unused `SAMPLE_DATA` flag (section 1A): either remove both, or make the data function per page choose sample data or the database through the flag. After this task, `lib/sample/` may be imported only by that switch and by tests.

- [ ] **P1-09 Map.**
  - Files: `app/[locale]/map/`, `components/map/*`, `lib/stats/map-queries.ts`.
  - Do: crash dots clustered on the server; the highway layer with totals; the filters; the list toggle; the bottom sheet on phones; hollow dots for imprecise locations.
  - Check: with 5,000 seeded crashes the map stays responsive on a mid-range phone; with tiles blocked, the list view still works.
  - Design and wiring: `/map` (UI-02) already has the layout, panel, bottom sheet, scrubber and a server-rendered list. In this task:
    - Swap the static map in `components/map/full-map.tsx` for the MapLibre `base-map.tsx` from P0-11, loaded only on this page. Keep the static map as the first paint and as the fallback when tiles or WebGL fail (show `Map.failed`).
    - Draw the layers with the same values as `lib/map/style.ts`. Draw our border and mask on top, never the Protomaps `boundaries` layer.
    - Turn on the disabled controls: filters, the BS/AD switch, the draggable scrubber (two handles), zoom, locate, layers, search, and the List/Map toggle.
    - Tapping a highway opens the highway panel (on phones, in the sheet); tapping a dot opens the crash sheet; sheets snap to half and full height; motion respects reduced-motion settings.
    - The panel and sheet show the tapped item, not the fixed NH17 and latest crash.

- [ ] **P1-10 Search.**
  - Files: `lib/db/queries/search.ts`, `app/[locale]/search/`.
  - Do: names in both scripts and spelling variants, places, highways and plates.
  - Check: a misspelt seeded name finds the right person; a hidden name finds nothing.

- [ ] **P1-11 Anonymous tips and rate limits.**
  - Files: `lib/net/{rate-limit,turnstile}.ts`, `app/[locale]/submit/tip/`.
  - Do: the tip form with the captcha; rate limits from SPEC 12.2 kept in Postgres and keyed by the Cloudflare IP header; tip photos handled as SPEC 7.1.
  - Check: the fourth tip in an hour from one address is refused; a tip appears in the Tips tab and can be turned into a crash.

- [ ] **P1-12 Corrections.**
  - Files: `app/[locale]/crash/[slug]/suggest/`, `components/forms/*`.
  - Do: "Suggest a correction", "Add a news link" and "Add a person" as submissions that store only the proposed change.
  - Check: a suggested change shows as a highlighted difference in review and changes the public page only after approval.

- [ ] **P1-13 My contributions and notices.**
  - Files: `app/[locale]/me/*`, `lib/workflow/notifications.ts`, email templates in both languages.
  - Do: the contributor's list with statuses; in-app and email notices for approved, rejected and changes requested; email settings.
  - Check: rejecting a submission sends an email in the user's language with the reason.

- [ ] **P1-14 Caching.**
  - Files: `infra/cloudflare.md`, `lib/net/cache.ts`, response headers.
  - Do: cache anonymous public pages for 60 seconds; skip the cache for any request with a login cookie; never cache `/review`, `/admin`, `/me`; purge a page when it changes.
  - Check: logged in, the response headers show no caching; an approval is visible to an anonymous visitor within a minute.

- [ ] **P1-15 End-to-end tests for this phase.**
  - Files: `tests/e2e/phase1.spec.ts`.
  - Check: Playwright runs the outcome at the top of this section at a phone-sized screen, plus the duplicate warning and the self-approval refusal.

**Phase 1 exit check:** the three "done when" lines in SPEC section 15, phase 1. Before moving on, at least two reviewers (O-11) have each cleared a few test items on staging.

---

## 10. Phase 2: news pipeline

**Outcome:** a day of real news produces drafts without help, a crash covered by many outlets in two languages becomes one draft, and the accuracy and daily cost are visible.

- [ ] **P2-01 Worker.** *(First version built 14 Nov 2026, ADR 0007: `worker/index.ts`, `pipeline_runs` instead of pg-boss, 30-minute schedule and "Collect now" in `/review`, outlet health listed there. Left: the Dockerfile, email alerts, the other scheduled jobs.)*
  - Files: `worker/index.ts`, `worker/schedule.ts`, `infra/Dockerfile.worker`, schema for outlets, feed_items, extraction_runs.
  - Do: the job queue; the schedules in SPEC 13.3; an admin page listing outlets and their health.
  - Check: a test job runs on schedule on staging and a failed job is retried and then reported.

- [ ] **P2-02 Collect and filter.** *(Built 14 Nov 2026: `lib/pipeline/{feeds,filter,normalize-url,robots,collect}.ts`, outlets in `content/outlets.json`. The spike's keyword rules were not available, so the rules are new (ADR 0007). Checked on real feeds: 8/8 outlets read, a second run adds nothing.)*
  - Files: `lib/pipeline/{feeds,filter}.ts`, tests.
  - Do: port `spike/collect_rss.py`: the 8 working feeds, the Nepali and English keyword rules, URL normalisation, skipping seen links; obey robots.txt, identify the bot, and wait 5 seconds between requests to one outlet.
  - Check: a run on staging stores new feed items and marks crash candidates; running it twice adds nothing new.

- [ ] **P2-03 Safe fetching and clean text.**
  - Files: `lib/net/safe-fetch.ts`, `lib/pipeline/fetch-article.ts`, tests.
  - Do: one fetch function for all user-supplied or feed-supplied URLs with every protection in SPEC 12.2 (no private addresses, limits on time, size and redirects); force UTF-8; extract the main text; store it privately with a hash.
  - Check: tests prove requests to a loopback address, a private address and a redirect to one are all refused; on the spike's 42 private articles, the extracted text is compared with the spike's. If it is clearly worse on Nepali sites, switch this one step to the spike's extractor in a small container and record why in an ADR.

- [ ] **P2-04 Extraction.**
  - Files: `lib/pipeline/{schema,extract,prompt}.ts`.
  - Do: port `spike/schema.py` to Zod, including the prompt rules; call Claude with structured outputs (read the current SDK docs first); Haiku first, Sonnet on a failed validation, a roundup, or 3 or more deaths; record model, prompt version, tokens and cost for every call; treat the article as data, never as instructions.
  - Check: the 42 private articles all produce valid records; the cost of the run matches the sum in `extraction_runs`.

- [ ] **P2-05 Grounding.**
  - Files: `lib/pipeline/ground.ts`, tests.
  - Do: port the check from `spike/evaluate.py`, including Nepali digits and number words; failures become flags on the draft.
  - Check: a record with a name that isn't in its article is flagged.

- [ ] **P2-06 Matching into drafts.**
  - Files: `lib/domain/{crash-match,person-match}.ts`, `lib/pipeline/ingest.ts`, tests.
  - Do: port the crash and person rules from `spike/dedupe.py` exactly (scores, thresholds, the same-article rule, ties to review); match against drafts and published crashes; attach to a draft, or create a submission for a published crash, or create a new draft; write claims and person mentions.
  - Check: feeding the 42 private articles in time order gives 8 crashes and no wrong merges of people, as in the spike.

- [ ] **P2-07 Accuracy test.**
  - Files: `scripts/eval-extraction.ts`, private labelled data outside the repository.
  - Do: `pnpm eval:extraction` prints the spike's four measures. Then run it on **a fresh labelled week (O-12) without changing any rule**.
  - Check: the numbers for the fresh week are written into `docs/methodology/accuracy.md`. Person precision must be 100% (no two different people merged). If it isn't, stop and fix before continuing.

- [ ] **P2-08 Choose the model.**
  - Files: `docs/adr/00xx-extraction-model.md`.
  - Do: run the test with Haiku only, Haiku with Sonnet as backup, and Sonnet only; pick the cheapest that keeps the numbers.
  - Check: the ADR holds the table of results and costs.

- [ ] **P2-09 News drafts in review.**
  - Files: `components/review/{source-reader,merge-suggestions,unresolved-names}.tsx`.
  - Do: the article beside the draft with matched names and numbers highlighted; conflicts side by side; merge suggestions; unresolved names kept in draft.
  - Check: a reviewer can settle a seeded many-outlet draft (conflicting tolls, two spellings, one unresolved name) in under five minutes on a phone.

- [ ] **P2-10 Paste a news link.**
  - Files: `app/[locale]/submit/from-link/`.
  - Do: the form fills itself from the link using the same pipeline; a known link goes straight to its crash.
  - Check: pasting a real article link gives a pre-filled form within about 10 seconds; pasting it again says it's already recorded.

- [ ] **P2-11 Guards and alerts.**
  - Files: `worker/jobs/{cost-guard,digest,telegram,outlet-health}.ts`.
  - Do: the spending steps at 80%, 100% and 120% of the cap; the Telegram alert for 3 or more deaths; the 07:00 digest; neither message contains names.
  - Check: with the cap set to a few cents on staging, each step triggers in turn; a seeded big crash sends one Telegram message.

- [ ] **P2-12 Article text retention.**
  - Files: `worker/jobs/purge.ts`.
  - Do: delete private article text after 12 months and keep the hash.
  - Check: a test with a back-dated row shows the text gone and the hash kept.

**Phase 2 exit check:** the three "done when" lines in SPEC section 15, phase 2, after the pipeline has run on staging for three days.

---

## 11. Phase 3: memorials and families

**Outcome:** a family claims a person and, from a phone on a slow connection, adds a story, three photos and two video links; hiding the memorial removes the name everywhere.

- [ ] **P3-01 Photo handling.**
  - Files: `lib/media/{process-photo,storage}.ts`, schema for media, tests.
  - Do: every step of SPEC 8.1: real type check, re-encode to three sizes, strip all metadata including location, perceptual hash and blocklist; one storage interface (disk now).
  - Check: upload a phone photo that has a GPS location; download the stored file and confirm no metadata remains; a renamed non-image file is refused.

- [ ] **P3-02 Family claims.**
  - Files: `app/[locale]/person/[slug]/claim/`, `lib/workflow/claims.ts`, schema for family_claims and person_guardians.
  - Do: the claim form; the phone number encrypted with a key kept outside the database; two approvals; the purge after 30 days; one invited relative.
  - Check: one approval isn't enough; after two, the claimant is a guardian; the back-dated purge test removes the phone number.

- [ ] **P3-03 Guardian dashboard.**
  - Files: `app/[locale]/me/memorials/[person]/*`.
  - Do: edit the story and facts; upload, reorder and caption photos; pick the cover; switches for tributes, the share card and the whole memorial; corrections to name and age recorded as family claims of fact.
  - Check: a guardian's change is live at once, appears in "Recent changes" for reviewers, and can be reverted with one click.

- [ ] **P3-04 Links and embeds.**
  - Files: `lib/embeds/{resolve-link,thumbnails}.ts`, `components/memorial/embed.tsx`, `worker/jobs/link-check.ts`, tests.
  - Do: port `spike/embeds/resolve_link.py` on top of `safe-fetch`; store small thumbnails on our server; show a still preview that loads the platform's player only on tap; the weekly re-check; the content security policy in SPEC 12.2.
  - Check: before a tap, the network tab shows no requests to YouTube, Facebook, Instagram or X; a private video is shown to the guardian as unavailable; re-test TikTok in a normal browser and record the result.

- [ ] **P3-05 The memorial page.**
  - Files: `app/[locale]/person/[slug]/page.tsx`, `components/memorial/*`.
  - Do: everything in SPEC 6.5: header, story, gallery, videos and posts, short facts, "what the news said", the status labels, the simpler page for injured people.
  - Check: at 360 px on a throttled connection the page is readable before the photos finish loading.
  - Design: UI-04 (handoff "Person / memorial"). Photos are always greyscale; placeholders are the 135° striped fill with a soft initial.

- [ ] **P3-06 Candles and tributes.**
  - Files: `components/memorial/{candle,tributes}.tsx`, schema.
  - Do: one candle per device per person per day; tributes with login and review; the guardian's off switch.
  - Check: a second candle on the same day doesn't count; a tribute is invisible until approved. *(First item on the cut list if time is short: keep candles, drop tributes.)*

- [ ] **P3-07 Reports and moderation tools.**
  - Files: `components/ui/report-button.tsx`, `lib/workflow/reports.ts`, `app/[locale]/admin/moderation/*`.
  - Do: the report button everywhere with the reasons in SPEC 7.5; the automatic hide rules; ban a user; undo all of a user's changes since a date; the site-wide read-only switch.
  - Check: three "this person is alive" reports from different accounts hide the page at once; the bulk undo restores the previous revisions; with read-only on, every form shows a notice and refuses to save.

- [ ] **P3-08 Hiding.**
  - Files: `lib/workflow/hide.ts`, tests in `tests/privacy/`.
  - Do: hide a name and hide a memorial; purge the page, share card and photos from the cache; remove from search and the sitemap.
  - Check: one test hides a seeded person and then searches every public page, the sitemap and the search results for the name. It must find nothing. This test is extended in phase 4 to cover the downloads and the API.

- [ ] **P3-09 Machine translation of stories (opt-in).**
  - Files: `lib/workflow/translate-story.ts`.
  - Do: when a guardian switches it on, offer the story in the other language, labelled "translated automatically", editable by the guardian.
  - Check: the label shows; the cost is recorded with the other AI spend.

**Phase 3 exit check:** the two "done when" lines in SPEC section 15, phase 3, done by a real person who isn't the developer.

---

## 12. Phase 4: research and remembrance

**Outcome:** a researcher can see the dangerous stretches of a highway, download the data, and get the same totals from the dashboard, the files and the API.

- [ ] **P4-01 Blackspots.**
  - Files: `lib/stats/segments.ts`, a migration for the statistics view, `worker/jobs/refresh-stats.ts`.
  - Do: link crashes with good location accuracy to the nearest segment within 500 m; per-segment counts over a rolling 3 years; the flag threshold as a setting.
  - Check: a seeded crash placed 100 m from a highway is linked to the right kilometre; one placed 2 km away is linked to none.

- [ ] **P4-02 One source for all numbers.**
  - Files: `lib/stats/queries.ts`, tests.
  - Do: every total on the site, in the files and in the API comes from these functions; natural-hazard crashes are a separate line with a filter.
  - Check: a test compares dashboard, download and API totals for five different filters and fails on any difference.

- [ ] **P4-03 Highway and district pages.**
  - Files: `app/[locale]/highway/[ref]/`, `app/[locale]/district/[slug]/`.
  - Check: a highway page lists its worst segments with their crashes.
  - Design: UI-05 (handoff "Highway"). The district page has no handoff screen; build it from the same parts (header stats, a cropped light map, charts, recent crashes). The "Worst 5 km stretches" in the `/map` highway panel come from the same query.

- [ ] **P4-04 Dashboard.**
  - Files: `app/[locale]/data/`, `components/charts/*`.
  - Do: the charts in SPEC 9.2 with shared filters, a table behind each chart for screen readers, and a download for each.
  - Check: every chart works by keyboard and stays within the page-weight limit.
  - Design: UI-06 (handoff "Research dashboard"). Turn on its disabled filters; the file sizes in the downloads list come from the real files, not fixed text.

- [ ] **P4-05 Downloads.**
  - Files: `worker/jobs/exports.ts`, `app/[locale]/data/downloads/`.
  - Do: the four files nightly and a frozen snapshot each month; hidden people as anonymous rows with an age band.
  - Check: the privacy test from `P3-08` now also searches the files; `people.csv` has no name column and no hometown below district.

- [ ] **P4-06 Police figures.**
  - Files: `scripts/import-police-stats.ts`, `app/[locale]/admin/police-stats/`.
  - Do: import the yearly district figures (O-13) with their source links; show them beside our counts with a coverage percentage.
  - Check: a district page shows both numbers for one fiscal year and links to the police document.

- [ ] **P4-07 Public API.**
  - Files: `app/api/v1/*`, `app/[locale]/data/api/` (documentation).
  - Do: the routes in SPEC 9.5, read-only, rate limited, with examples. *(On the cut list: the downloads can launch without it.)*
  - Check: the 61st request in a minute is refused; the privacy test covers the API.

- [ ] **P4-08 Remembrance and sharing.**
  - Files: `app/[locale]/remember/`, home page section, `app/[locale]/person/[slug]/card/route.tsx`.
  - Do: anniversaries by BS date; "Remembered today" on the home page; the share card image, only when allowed.
  - Check: a seeded person whose crash was one BS year ago today appears; a hidden person never does; the card renders Nepali text correctly.

- [ ] **P4-09 Explaining pages.**
  - Files: `app/[locale]/{methodology,about,transparency}/` (`contribute` is already built, UI-08).
  - Do: the definitions in SPEC 9.1, the accuracy results, the limits of the data, costs and AI spend.
  - Check: a reader who isn't on the project can say, after reading, what the headline number does and doesn't include.

**Phase 4 exit check:** the three "done when" lines in SPEC section 15, phase 4.

---

## 13. Phase 5: hardening and launch

**Outcome:** the site is safe to open to the public, the policies are published, and reviewers have kept up with the queue for a week.

- [ ] **P5-01 Security review.**
  - Do: run a full security audit of the code; go through SPEC 12.2 line by line; confirm the permission tests cover every route; test the content security policy and the fetch protections on staging.
  - Check: a written report in `docs/security/review-1.md` with every finding fixed or accepted with a reason.

- [ ] **P5-02 Server check.**
  - Do: go through SPEC 12.4 on the production server; scan it from outside.
  - Check: only ports 80 and 443 answer, and only to Cloudflare.

- [ ] **P5-03 Load and speed.**
  - Do: 200 visitors at once on the home and map pages; measure the pages on a throttled low-end phone profile.
  - Check: no errors under load; the limits in SPEC 11.4 are met; the results are saved in `docs/performance/`.

- [ ] **P5-04 Accessibility.**
  - Do: automated checks on every page type, then a manual pass by keyboard and with a screen reader, in both languages.
  - Check: no serious findings left.

- [ ] **P5-05 Restore drill and runbooks.**
  - Files: `docs/runbooks/{deploy,restore,rebuild-server,rotate-secrets,takedown}.md`.
  - Do: the second admin (O-7) rebuilds the site on a fresh server from the backup, using only the runbooks.
  - Check: it works, and the time taken is written down (target: under 4 hours).

- [ ] **P5-06 Policies.**
  - Files: `app/[locale]/policies/*`.
  - Do: content, privacy, takedown and trademark policies in both languages, reviewed by the lawyer (O-15); the legal operator and contact are named.
  - Check: the lawyer's comments are resolved.

- [ ] **P5-07 Name, domain and brand.**
  - Do: replace the working name everywhere (O-14); final logo; set up email sending for the new domain.
  - Check: a search of the code for the working name finds nothing; a magic-link email arrives in an inbox, not in spam.

- [ ] **P5-08 Reviewer guide.**
  - Files: `docs/reviewers/guide.md` in both languages.
  - Do: how to review, the naming and spelling rules, when two approvals are needed, how to treat families, what never to publish.
  - Check: a new reviewer can handle ten test items correctly after reading it.

- [ ] **P5-09 Closed beta.**
  - Do: two weeks with 3–5 reviewers and the live news pipeline, the site not yet announced.
  - Check: the queue stayed within the targets for 7 days in a row; every problem found is fixed or listed.

- [ ] **P5-10 Donations and transparency.**
  - Do: the Open Collective link (O-16) and the first month's costs on `/transparency`.

- [ ] **P5-11 Launch checklist.**
  - Check: every line of section 2 of this plan is true on production; alerts reach two people; the read-only switch was tested; the second admin holds every key.

- [ ] **P5-12 Make the repository public.**
  - Do: scan the whole git history for secrets and for real people's data; replace real names in documentation examples with invented ones if any remain; then make it public and label the first `good first issue`s.
  - Check: the scan is clean. This step can't be undone, so the owner confirms it.

---

## 14. Checks that apply to every pull request

- [ ] The route or action calls the policy, and a test covers who may and may not use it.
- [ ] Inputs are validated on the server, with maximum lengths.
- [ ] New text exists in Nepali and English.
- [ ] The screen was looked at 360 px wide.
- [ ] Anything showing a person respects hidden names, hidden memorials and the children's rule.
- [ ] A write creates a revision and an audit entry.
- [ ] No real names, article text or secrets were added.
- [ ] The full test suite passed locally and in CI.
- [ ] Every changed screen was screenshotted at 360, 390 and 1440 px in both languages, and every image was opened (rule 14).
- [ ] The page has the shared site nav and footer, with the right link marked current (also on login, error and empty pages).
- [ ] The screen follows the handoff tokens: no rounded corners, red only for deaths and the primary action, flush-left text, 44 px touch targets.
- [ ] No control looks usable but does nothing (rule 13), and no page owned by a finished task still imports `lib/sample/` (rule 12).

---

## 15. Out of scope for the MVP

Don't build these now, even if they look easy (SPEC section 15, "Later"):

- Collecting from outlets that have no feed
- Video uploads
- Survivor stories and anniversary emails
- Automatic detection of graphic images
- Traffic-volume rates
- Offline mode
- eSewa or Khalti donations
- Crashes outside Nepal
- A mobile app

---

## 16. When to stop and ask the owner

Stop and ask instead of improvising when:

- A task needs something from section 7 that isn't there yet.
- A decision in section 3 looks wrong in practice. Bring the evidence; don't work around it.
- Person-matching precision on fresh data is below 100%, or any test shows a hidden name leaking.
- A library the spec names turns out to be unmaintained or unsuitable.
- A cost would exceed the figures in SPEC 13.4.
- Anything can't be undone: deleting production data, rewriting git history, making the repository public, sending messages to outlets, families or reviewers.
- A phase's exit check can't be met after two honest attempts.

---

## 17. Keeping this plan current

- Tick tasks as they're done, in the same pull request as the work.
- At the end of each phase, add a short note below: the date, what was checked and how, what was cut or moved, and anything learned that changes later phases.

### Phase notes

**13 Nov 2026, Phase 0 in progress (not a phase end).**

- **Done and checked:**
  - P0-09 permissions: tests pass.
  - P0-18 static map renders: screenshots.
  - UI-01 Home and UI-02 Full map built on sample data (not yet wired, so unticked): screenshots at 360, 390 and 1440 px in both languages, plus a production build.
- **Mostly done:**
  - P0-05 languages: CI half open.
  - P0-06 BS dates: 15 of 20 named pairs; every-day cross-check done.
  - P0-11 map files: database half open.
  - P0-17 design system: contrast check open.
- **Changed direction:** the visual design moved from the Survey Toposheet to the Modernist handoff the same day. Toposheet components were removed. One leftover remains: `.impeccable/surfaces/app-locale-page-tsx.md`.
- **Learned:**
  1. The design was settled faster on sample data than it would have been after the database. Rule 12 limits how long that can last.
  2. A static SVG map rendered on the server is enough for the Home hero and small maps, and costs no map JavaScript. MapLibre is needed only on `/map` and the pin picker.
  3. Long `next dev` sessions on this Windows machine can crash the worker pool (section 1A).
  4. **Dynamic pages must read `params` inside `<Suspense>`.** With Cache Components on, a page that awaits `params` at the top level logs "params accessed outside of Suspense" in dev. Pass the un-awaited `params` promise to a child inside `<Suspense>` with a skeleton fallback, as `app/[locale]/crash/[slug]/page.tsx` does. Every later dynamic route (`person/[slug]`, `highway/[ref]`, `district/[slug]`) follows the same shape. The screenshot script's console report is what caught it, so keep reading that report (rule 14).
  5. A cropped static map needs its pixel scale set from the crop (`pxPerUnitForSpan`); the default scale draws giant dots on a small crop.
- **Next, in order:**
  1. Finish P0-01 and P0-02, then make the first commit.
  2. P0-04 local database.
  3. UI-07 Report a crash, then UI-04 Person, alongside the database work (UI-03 Crash page is built).
  4. P0-07 places and P0-08 login (needs O-5 and O-6).
