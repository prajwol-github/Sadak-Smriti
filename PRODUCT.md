# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided in `docs/SPEC.md` section 2 and 11.2: TypeScript, Next.js (App Router, server-rendered), PostgreSQL + PostGIS with Drizzle, next-intl (`/ne`, `/en`), MapLibre GL JS with self-hosted PMTiles, Tailwind CSS, pnpm. Hosted on one VPS behind Cloudflare.

## Users

- **Families and friends** of people killed on Nepal's roads. They come to remember one person, often on a phone, often in grief. They want a dignified page they control.
- **The public in Nepal**, mostly on low-end Android phones over mobile data, checking what happened on the roads they use.
- **Contributors** who report a crash or fix a mistake, usually from a phone, sometimes right after reading the news.
- **Reviewers** (invited) who clear a queue of drafts, often on the go.
- **Researchers and journalists** who need clean, sourced, downloadable data and a map of dangerous highway stretches.

## Product Purpose

Sadak Smriti (सडक स्मृति, working name) has two jobs: remember every person killed on Nepal's roads as a person, not a number; and make road deaths measurable down to the highway stretch, with every fact sourced and the data open. Success after 12 months: 90% of reported road deaths recorded within 48 hours, 200 memorials claimed by families, the data cited in research or major news, and no living person ever published as dead.

## Positioning

A memorial and an open dataset in one record. Each crash links its news sources and shows where they disagree; each person killed has a page their family can claim. Nothing reaches the public without a human reviewer.

## Operating Context

News articles from Nepali outlets are drafted automatically and reviewed by people. Dates are shown in Bikram Sambat (BS) and AD; the Nepali fiscal year starts on 1 Shrawan. Highways are the numbered national highways (NH01…), cut into 1 km segments for blackspot statistics. The map shows Nepal's border as in the official map published by the Survey Department in 2020, with Lipulekh, Kalapani and Limpiyadhura inside Nepal, drawn solid.

## Capabilities and Constraints

- Nepali and English from day one; every user-facing string exists in both.
- Must work on slow 3G and a $100 Android phone: HTML+CSS under 50 KB, non-map JS under 120 KB compressed; the map's JS loads only on `/map`.
- Map tiles are served from our own server; no third-party tile or font requests.
- WCAG 2.2 AA: contrast 4.5:1, 44 px touch targets, keyboard and screen reader use, a list alternative to the map, reduced motion respected.
- Privacy rules are product rules: hidden names appear nowhere; injured children are hidden by default; injured people's pages are not indexed.
- Full requirements: `docs/SPEC.md`. Build order: `docs/PLAN.md`.

## Brand Commitments

- Working name "Sadak Smriti" / "सडक स्मृति", to be replaced before launch; the final name and logo are reserved.
- Tone: dignity over drama. Calm, short sentences. "Killed" in facts; the person's name in text; never "victims" or "fatalities" on a person's page.
- Quiet colours with plenty of white space. Red is used only for counts of deaths, never for decoration.
- No crash or wreckage photos in lists; faces of people instead. No gore, no autoplay, no blame language.
- Nepal's border follows the official 2020 map, including Lipulekh, Kalapani and Limpiyadhura, drawn solid (owner's decision, 13 Nov 2026).

## Evidence on Hand

- Feasibility spike in `spike/` with results in `spike/SPIKE_RESULTS.md` (8 working RSS feeds, extraction and matching accuracy).
- No real memorial content, photos or testimonials exist yet. Development uses invented people only; real names from the spike must never appear in the UI, seeds or tests.

## Product Principles

1. Nothing reaches the public without a human.
2. Every fact has a source, and disagreements are shown, not hidden.
3. Families have the final word on their person.
4. Dignity over drama.
5. Light on phones.

## Accessibility & Inclusion

WCAG 2.2 AA (see Capabilities). Devanagari must render well at small sizes on low-end screens; the Nepali interface is the default for visitors from Nepal.
