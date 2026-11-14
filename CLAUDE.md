# Sadak Smriti (सडक स्मृति)

A memorial and open dataset for people killed on Nepal's roads. **Read `docs/SPEC.md` (what and why) and `docs/PLAN.md` (order, tasks, checks) before any task.** The spec wins over the plan. `PRODUCT.md` holds product truth for design work.

@AGENTS.md

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm dev:sample` | Dev server; `dev:sample` shows invented sample data on the home page |
| `pnpm check` | Lint, type check and all tests. Run before calling anything done |
| `pnpm map:download` | Download boundaries, OSM highways and the basemap PMTiles into `data/raw/` and `public/tiles/` (needs Docker) |
| `pnpm map:build` | Build `public/map/*.geojson` and `preview.svg` from `data/raw/` |
| `pnpm db:up` / `db:migrate` / `db:reset` / `db:studio` | Local PostGIS in Docker (needs `.env.local` from `.env.example`); see `db/README.md` |
| `pnpm db:queries` | Regenerate `db/queries/*.sql` after adding or changing a query (`pnpm check` fails until you do) |
| `pnpm worker` / `pnpm worker --once` | News worker: collects every 30 min and on "Collect now"; `--once` does one run and exits (ADR 0007) |
| `pnpm pipeline:outlets` | Copy `content/outlets.json` into the database |
| `pnpm users:role <email> [role]` | The only way to make a reviewer or admin; run on the server, as `migrator` (ADR 0006) |
| `pnpm screenshot <outDir> <url...>` | Capture pages at 390 and 1440 px; reports console errors and overflow |

## Layout (so far)

- `app/[locale]/` pages (root layout here; `/ne` and `/en`); `proxy.ts` routes languages
- `components/` UI only, no data access (`site/` shell, `home/`)
- `lib/domain/bs-date.ts` the only code that touches the BS date library
- `lib/policy/can.ts` the only place permissions are decided; `matrix.test.ts` checks every SPEC 4.2 cell; `coverage.test.ts` fails if a route or server action skips it
- `lib/i18n/` next-intl config; `messages/{ne,en}.json` must have identical keys (tested)
- `lib/home/` home data (sample/empty until the database exists)
- `lib/stats/` cached loaders (`"use cache"` + `cacheLife` + `cacheTag`), one function per dashboard module plus `listCrashes(page)`; sample data now, the database later (PLAN P4-02, P1-09). `paginate.ts` is the shared pager logic
- `components/data/` the dashboard as independent modules (`modules.tsx`), each in its own `<Suspense>` via `Slot` with a skeleton (`layout.tsx`). `components/map/crash-list.tsx` is the paginated list; pages 2+ are static routes `/map/page/N`, not `?page=`
- `lib/auth/` sign-in (Better Auth, Google only), `actor.ts` turns a session into the policy's Actor; `lib/db/auth-adapter.ts` is Better Auth's database access
- `app/[locale]/admin/users/` accounts page (ADR 0006): role changes and deactivation go through the database functions `staff_set_role` / `staff_set_ban`, never a direct write; `components/review/staff-nav.tsx` is the staff bar with Sign out
- `app/[locale]/review/submissions/` the review queue and decision screen (ADR 0008); `lib/workflow/decide.ts` applies a decision in one transaction (not your own, not twice, two approvals where needed). Staff create and edit directly, logged; visitor and contributor items need a reviewer
- `app/[locale]/review/crashes/` the staff crash and person editor and its history (ADR 0008); `lib/workflow/edit-crash.ts` applies each change in one transaction (policy, version check, rules, revision with the reason, audit); `lib/forms/crash-edit.ts` validates the forms. Forms must send their typed values back on error (`EditState.values`), because React 19 resets a form after its action
- `lib/pipeline/` news collection; `worker/` the background process; `lib/db/standalone.ts` is the database connection for the worker and scripts
- `lib/map/preview-projection.ts` shared by the map build and the home map preview
- `scripts/map/` map data pipeline; `scripts/dev/` screenshot tool

## Decisions made during setup (do not reopen without a reason)

- **Next.js 16.4** with `cacheComponents` and `partialPrefetching` on. Request middleware is `proxy.ts` (renamed in 16). `params` is a Promise. Read `node_modules/next/dist/docs/` before using a Next API.
- **next-intl 4.15** following its official Cache Components setup (`next/root-params`), `localePrefix: "always"`, default `ne`. Visitors from Nepal (`CF-IPCountry: NP`) go to `/ne` even with an English browser; a chosen language (cookie) wins.
- **Border:** official 2020 map (Lipulekh, Kalapani, Limpiyadhura inside Nepal), drawn solid. Never draw OSM/Protomaps boundary layers. See `docs/adr/0002-map-sources.md`.
- **BS dates:** see `docs/adr/0003-bs-date-library.md`. Tables after BS 2083 are unconfirmed; act before April 2027.
- **Visual world: the Modernist system from `design_handoff_sadak_smriti/`** (replaced the earlier Survey Toposheet on 2026-11-13; `README.md` there is the look-and-layout spec for the 7 public screens). Two surfaces: the ink map (home hero, `/map`) and the light ground. Tokens in `app/globals.css`. Red-500 for numbers on ink, red-700 for small red text on light. Fonts: Archivo (Latin) and Noto Sans Devanagari (Nepali), self-hosted via `next/font`. `.impeccable/surfaces/app-locale-page-tsx.md` describes the old Toposheet and is out of date.
- **Live maps (14 Nov 2026, owner's request: real zoomable maps everywhere, ready to highlight highways where crashes happened):** `components/map/live-map.tsx` (client, MapLibre 6) draws our own PMTiles basemap from `/tiles` in the Modernist palette (`lib/map/live-style.ts`: re-coloured Protomaps layers, no boundaries/POI layers, an outside-border mask, our border, highways by risk, selected highway with halo, crash dots, "NH17" labels). Used on Home, `/map`, crash and highway pages with a working zoom rail (zoom, locate, layers, full screen/expand). It starts only when its box is visible and on screen. The static SVG (`StaticMap`) is passed as children: first paint, no-JavaScript view, and the fallback if WebGL or tiles fail. Fonts for labels are self-hosted in `public/fonts` (Protomaps glyphs, OFL). MapLibre's worker is given to the bundler with `setWorkerUrl(new URL(…, import.meta.url))`. **Do not put a React-controlled `className` on MapLibre's container** (React overwrites the `maplibregl-map` class). Server components pass plain props only (`dotPath`, `highwayLinks`), never functions. SPEC 6.2's "no map JavaScript on Home" is superseded for Home by this request.
- **Screens built so far (sample data in `lib/sample/data.ts`):** Home, `/map` (static map; interactive MapLibre map and filters are P1-09, so those controls are disabled), Crash (`/crash/[slug]`), Remember (`/remember`), Person (`/person/[slug]`), Report a crash (`/submit`, real database), Highway (`/highway/[ref]`), Research dashboard (`/data`), Contribute (`/contribute`, real content from `content/contributors.json`; see `content/README.md`). All seven handoff screens are built; what is left is wiring them to the database. Charts: `components/charts/charts.tsx` (server-rendered SVG; follow the `dataviz` skill).
- **One header and one footer on every page** (owner's decision, 13 Nov 2026): `<SiteNav current="…" />` and `<SiteFooter />` from `components/site/`. The header is always the dark Home bar; there are no variants (the handoff's light inner-page header and `/map`'s own bar were dropped on purpose). `lib/i18n/nav.test.ts` fails if a page lacks either.
- **Share cards are drawn in the browser** (`components/contribute/share-card.tsx`), not with Next's `ImageResponse`: Satori cannot shape Devanagari. Reuse that method for memorial cards (P4-08).
- **Images load only from our own server** (SPEC 12.2): contributor photos are files in `public/contributors/`; LinkedIn photos can't be used.
- **Dynamic routes read `params` inside `<Suspense>`** (pass the promise to a child component, with a skeleton fallback). Reading it at the top of the page logs a Cache Components error in dev. Pattern: `app/[locale]/crash/[slug]/page.tsx`.
- **pnpm 12:** build scripts for `esbuild`, `@parcel/watcher`, `@swc/core`, `sharp`, `unrs-resolver` are set to not run (prebuilt binaries). `sharp` will need `true` when photo processing starts (P3-01).

- **Lists paginate with static routes, not `?page=`.** Reading `searchParams` makes the page dynamic, and Next then re-sends the page's whole RSC payload on every request (measured: `/map` 88 KB to 162 KB gzipped). Use `/thing/page/[page]` with `generateStaticParams`.
- **Async modules inside `<Suspense>` are delivered by an inline script even when prerendered** (the content is in the HTML, in a hidden block that a small script swaps in). So with JavaScript off, a panel shows its skeleton. Use `Slot` for panels backed by real queries; keep text a reader must have without JavaScript outside `Suspense`.

- **Sign-in and roles (ADR 0006):** Google only; everyone starts as contributor; roles only via `pnpm users:role` (the website's database role cannot write `users.role`); staff powers need an authenticator-app code per session (12 h), checked by us because Better Auth's plugin doesn't challenge Google sign-ins. Never put a staff member's name or email in the repo. Pages reading the session stay inside `<Suspense>`; never read it in the site header (it would make every page dynamic).

- **Security audit of 14 Nov 2026, all findings fixed** (details and how to verify: `docs/HANDOVER.md`). Rules that came out of it: `app/api/auth/[...all]/route.ts` is an allowlist (Google callback and error page only); add a path only after checking what it lets a signed-in user do to their own account. The daily clean-up in `lib/maintenance/retention.ts` (run by the worker) keeps the privacy promises; a new place that stores a contact or an IP hash must be added to it. Production refuses Cloudflare test Turnstile keys.

## Rules

Follow PLAN section 4 (working rules) and section 14 (per-PR checks). In short: policy call and Zod validation on every write; both languages for every string; check every screen at 360 px; no real names anywhere in code, seeds or tests (spike data is git-ignored).
