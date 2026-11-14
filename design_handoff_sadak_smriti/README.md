# Handoff: Sadak Smriti (सडक स्मृति) public UI

## Overview
Sadak Smriti remembers people killed on Nepal's roads and keeps a sourced, open record of every crash. This bundle defines the visual design for 7 public screens, each at mobile (390 px) and desktop (1440 px): Home, Full map, Crash, Person/memorial, Highway, Research dashboard (`/data`) and Report a crash. Product behaviour is defined in `SPEC.md` (sections 6–9). This file covers only the look and layout.

## About the design files
The files here are **design references made in HTML**. They show the intended look and layout. They are not production code. Rebuild them in the app's stack (per SPEC: Next.js App Router, Tailwind, MapLibre + PMTiles, a light SVG chart library). Use the existing patterns and libraries of that stack.

- `Sadak Smriti Final (standalone).html`: open it in a browser to view every screen (pan and zoom). It works offline.
- `source/Sadak Smriti Final.dc.html`: the readable source markup. All styles are inline. Data for the lists is in the `<script data-dc-script>` block at the bottom.
- `source/NepalMap.dc.html`: the stylised map drawing. It has the Nepal outline, highway lines, crash dots and the faded Kathmandu street pattern. **These are placeholders.** In production, use MapLibre with real OSM highways and the style rules below.
- `tokens/styles.css`: the Modernist token sheet and component classes. It is the source of truth for colours, type and spacing.

## Fidelity
**High fidelity.** Match the colours, type, rules and layouts. All figures, names, highway numbers and map shapes are invented placeholders.

## Design tokens
| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f3f2f2` | Page ground |
| `--color-surface` | `#eae9e9` | Tinted rows, info bars |
| `--color-text` (ink) | `#201e1d` | Text, 2px rules, dark bands, **ink map background** |
| `--color-accent` | `#ec3013` | Death counts, primary button, highest-risk roads |
| accent-100 / 300 / 500 / 700 | `#fff2ef` / `#ffc4b8` / `#ff563c` / `#ae1800` | Duplicate-check panel / soft bars / red on ink / red text at body size |
| neutral-100…900 | `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b` | Fills, hairlines (400), muted text (700); land on ink map (900) |
| Radius | `0` everywhere | Never round a corner. The only round shapes are the crash dots |
| Shadow | `--shadow-lg` | Only for floating map panels and bottom sheets |
| Font | Archivo 400 / 600 / 800 (headings 800, letter-spacing −0.015em). Devanagari: Noto Sans Devanagari | |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 px; page gutter 32 px desktop, 16 px mobile | |

**Type scale**
- Hero counter: 112 px desktop, 76 px mobile, weight 800, letter-spacing −0.045em.
- H1: 44–64 px. H2: 32 px. H3: 22–25 px. H4: 20 px.
- Body: 15 px with line-height 1.55. Memorial story: 19 px with line-height 1.65.
- Labels: 11 px, weight 600, uppercase, letter-spacing 0.08em, neutral-700.
- Stat values: 24–34 px, weight 800.

## Theme rules
1. **Red means death.** Red is used only for numbers of people killed, for roads coloured by deaths per km, for crash dots, and for the primary action button. Never use it for decoration. Banners and CTAs use ink bands.
2. **Rules organise everything.** Use 2px ink rules between major sections and around frames. Use 1px neutral-400 hairlines between rows. Layouts sit on visible grids of equal cells.
3. **Flush left.** Headings, copy and button labels sit on the left, including inside wide buttons. Never centre them.
4. **Faces, not wreckage.** Never show crash photos. Person photos are greyscale (`.grayscale`); placeholders are a 135° striped neutral fill. Use a soft initial when there is no photo.
5. **Two surfaces.** Use the **ink map** (`#201e1d` ground, land `#2d2b2b`, outline `#7d7979`, labels `#eae7e7`) for the Home hero and the Full map. Use the **light ground** for every content page and for the small maps inside them (land `#f8f4f4`, 2px ink outline).
6. Touch targets are at least 44 px. Contrast is at least 4.5:1. On ink, use red-500 for numbers; on light, use red-700 for small red text.

## Map style (MapLibre)
- **Highways:** colour by killed per km.
  - On ink, from lowest to highest: `#7d7979`, `#ff9783`, `#ff563c`, `#ec3013`.
  - On light, from lowest to highest: `#9b9797`, `#ff9783`, `#ec3013`, `#ae1800`.
  - Line width is 2.2 px, plus 0.9 px per risk step.
- **Selected highway:** 6 px line in accent red, with a 16 px halo (accent at 18–28% opacity). Other roads fade to 40% opacity.
- **Crash dots:** radius = 3 + 2.6·√killed. Exact locations are filled red with a 1.5 px ground-colour stroke. Approximate locations are hollow, with a 2 px red stroke (the legend explains this).
- **Latest crash:** 2 concentric rings, plus an ink or red label chip ("14 KILLED").
- **Minor roads:** 1 px dashed (3/3), neutral.
- **Graticule:** 1 px lines at 7–8% ink, with small labels ("84°E").
- **Faded city:** a Kathmandu Valley street layer at the right edge of the hero and the map, about 420 px wide on desktop and 140 px on mobile. Opacity is 0.5, masked with `linear-gradient(90deg, transparent, #000 75%)`.
- **Zoom rail:** a vertical stack of 48 px squares (+, −, locate, layers, expand). On ink it has a 1px neutral-700 border and the expand button is red-500. On light it has a 2px ink border.

## Screens

### 1. Home (`/`)
**Desktop**
- **Nav:** a 68 px ink bar. Brand "Sadak Smriti" in 22/800 with "सडक स्मृति" beside it. Then the links Map, Crashes, Remember, Data, Contribute, a search icon, "नेपाली / EN", and a light "Report a crash" button.
- **Hero:** a full-bleed ink map, 720 px tall.
  - **Counter,** top-left at 96 px from the left: the label "RECORDED SINCE 1 BAISAKH 2083", "1,184" at 112 px in red-500, and "people killed on Nepal's roads" at 26/800.
  - **Zoom rail** on the left edge, 24 px in.
  - **"Latest" card,** top-right, 300 px wide: title, faces row, "14 killed · 6 injured".
  - **"Tap the map to expand ↗"** button, bottom-right.
  - **Stat strip:** pinned to the bottom, 5 equal ruled cells: Crashes, Injured, Last 7 days (red), Worst highway, Police FY total. Tapping anywhere on the map opens `/map`.
- **Sections below.** Each is separated by a 2px ink rule:
  1. **Remembered today:** a 360 px intro column, then 3 portrait cards (300 px photo, name 22/800, Nepali name, age, hometown, a short quote, candles).
  2. **This week on the roads:** a 360 px intro column, then a timeline. The day label sits beside a vertical 2px line with square nodes; each row shows place, road, vehicles and "N killed" in red-700.
  3. **In the news:** 4 equal columns, each with outlet, language, headline ↗, date and type, and "Crash: … →". The note under the heading says "We never copy article text."
  4. **Police statistics** (1.4fr) and **Police reports** (1fr), side by side.
     - The statistics table has the columns District, Police 81/82, Recorded here (red-700), and Coverage (a 70 px bar plus %).
     - Each report row has a 44×56 ink-outlined type box (PDF / NOTE / CSV), a title, the source and the date.
  5. **CTA band:** ink, 2 equal columns.
     - Left: "Know of a crash we haven't recorded?" with "Report a crash →" and "Send a tip".
     - Right: "Lost someone on the road?" with "Add a memory →".
  6. **Footer row:** About, Methodology, Open data · CC BY 4.0, Policies, Transparency, Donate, Code AGPL-3.0.

**Mobile**
- A 56 px ink header.
- The counter (76 px).
- A 250 px ink map with an "Expand map ↗" chip.
- A horizontally scrolling stat strip with 150 px cells.
- A "Latest" block.
- Remembered today as a list: a 72×88 photo, the name, and the quote.
- This week, then In the news, then Police statistics (bars), then the two ink CTAs.

### 2. Full map (`/map`)
**Desktop:** a full-screen ink map.
- **Top bar,** floating with no background: brand, filter dropdowns (Fatal only, Vehicle, Crash type, BS/AD), "List view", and a light "✕ Close map" button.
- **Highway panel,** floating at left 24, top 80, 360 px wide, light surface, `--shadow-lg`:
  - A red header with "NH04 · 174 KM", the name at 30/800, and the Nepali name.
  - 3 stat cells: Crashes, Killed (red), Injured.
  - "Worst 5 km stretches": rank, place, km range, "N killed".
  - A primary button, "Open highway page →".
- **Zoom rail:** on the right edge.
- **Time scrubber:** pinned to the bottom, 104 px tall, ink with 94% opacity. It has the period label on the left, weekly bars (the current week in red-500), BS month labels, and 2 light drag handles.

**Mobile:**
- Map at full screen. The top bar has back, search, and a light filter button.
- A bottom sheet, 470 px high, with a drag handle:
  - Crash date and time, the title, and the place.
  - Killed / Injured / On board.
  - "People killed" as 36 px face tiles, 7 per row, then "11 named · 3 not yet named · Confirmed by…".
  - A pinned "Full crash page →" button.
- For a tapped highway, the sheet uses the panel content above.

### 3–7. Inner pages (light ground, 64 px nav with the active link underlined 2px)
- **Crash:**
  - The header grid splits into the title block and 3 large counts: Killed is 72 px red, then Injured and On board.
  - Main column: People killed (4-column cards; "Name withheld at the family's request" shows as an empty tile), Injured, "Where reports disagree" (claims shown as linked boxes; the final one is filled ink), and a Sources table.
  - Right column, 420 px: a small map, Place, Vehicle, "Stated causes" with attribution, and action buttons.
  - **Mobile keeps the map:** a 200 px strip under the counts, then the place details, the disagreement bar, People, Sources, and actions.
- **Person / memorial:**
  - Desktop: a 520 px cover photo with the identity block beside it. Tags read "Killed" and "✓ Confirmed by family". The name is 64/800, the Devanagari name is 30 px, then alias, age and hometown, and the crash link. The candle button is primary, with the count shown beside it.
  - Below that: the story at 19 px, a photo grid, click-to-load embed cards (the platform label says "TAP TO LOAD"), and Tributes.
  - Right rail: "Who she was" facts, the crash, "What the news said" spellings, and the family/memory actions.
- **Highway:** a header with 4 stats and a cropped map. Then a full-width chart of killed per 1 km segment: 174 bars, blackspots in red. Then the Top 10 blackspots table, charts by vehicle and by time of day, deaths by month, and recent crashes.
- **Research dashboard:**
  - A 280 px filter rail: period, province, district, highway, vehicle, crash type, a natural-hazard checkbox, and downloads with file sizes.
  - A KPI row of 5 cells.
  - Charts: a line chart of killed and crashes by month (with a dashed police average); and horizontal bars by province, vehicle, crash type and road user.
  - Columns for time of day, an age/sex pyramid, and police coverage.
  - Every chart has "CSV ↓".
- **Report a crash:**
  - A "paste a news link" bar.
  - A 5-step header; the current step is filled ink.
  - Step 2 has selects plus a map pin.
  - A red-100 "Is it one of these?" panel with duplicate cards and "Yes, add to this crash".
  - Mobile: a progress bar, vehicle chips (selected = ink fill), and −/+ steppers at 44 px.

## Interactions
- Hover and press states come from the accent ramp (600 when pressed on light, 400 on ink). Focus is a 2px accent outline with a 2px offset.
- Clicking the Home map opens `/map`. Tapping a highway opens the highway panel. Tapping a dot opens the crash sheet.
- Bottom sheets snap to half and full height.
- Embeds stay static until tapped. There is no autoplay, and motion respects reduced-motion settings.
- Every map view has a List alternative.

## Assets
- Icons: Lucide (search, plus, minus, locate, layers, maximize-2, filter, flame for the candle, menu).
- No image assets are included. Photos come from families and are shown in greyscale.
- Map data: OSM highways plus the government's boundary files (see SPEC 9.3 and 10.1).
