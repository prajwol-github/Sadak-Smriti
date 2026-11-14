---
version: 1
slug: "app-locale-page-tsx"
primary_target: "app/[locale]/page.tsx"
related_targets: ["app/[locale]/map/page.tsx"]
---

## Scope

Home page (`/ne`, `/en`). Visitor mode: Read. The shared visual world chosen here (the Survey Toposheet) also governs the map, crash, person, highway and data pages.

## Audience and job

The public on phones in Nepal, and families. They want to know what happened on the roads recently and see who is remembered today. Actions: open the map, open a crash, report a crash, add a memory.

## Proof and content

Real data only once it exists; the home page reads from published crashes. Until then, invented seed data, labelled as such. Empty state: "No crashes recorded yet" with a contribute link.

## Constraints

HTML + critical CSS under 50 KB; no map JS on the home page (static map preview image or inline SVG). Nepali default. Red only for death counts. WCAG 2.2 AA, 44 px targets.

## Direction contract

THESIS: Every crash and every person is recorded the way Nepal records its land: on a sheet, with a grid reference, a legend and a source. Refuses the category default of a hero stat over rounded card grids.

OWN-WORLD: Map paper (#FBFBF7) inside a pale collar field (#E6EBE1) with grid-blue graticule ticks and coordinates; ink #1F2A2E rules at 1.5–2 px; highways in road ochre (#E1A03C); forest tint (#C8DDBE) for portrait wells; red (#B3261E) only for death counts. Square corners, ruled boxes with inset labels (legend boxes), km-stone chips (ochre cap with highway ref, white base with km). State is a printed map mark, never a colour: filled diamond = verified, hollow diamond = single source, hollow dot = approximate place. Mukta for both scripts.

STORY: The visitor sees how many people have been killed since recording began and that every number has a source, scans recent crashes as a gazetteer with highway and km, sees who is remembered today, and goes to the map, a crash, or reports one.

FIRST VIEWPORT: Desktop: a sheet with a collar of graticule ticks; title block (both scripts) top-left, nav across, sheet number top-right. Left reading column (≈600 px): legend box with the count in red at ~76 px, one sentence, police context, primary "Report a crash" and "Add a memory"; below it the recent-crashes gazetteer (date BS/AD, place, km stone, killed · injured). Right: the map face with the national-highway map preview and a legend box. Bottom strip: "Remembered today" faces and a scale bar. Phone: collar thins to a top tick band; legend box first, then gazetteer, then map preview, then remembered today.

FORM: Survey Department 1:50,000 toposheet; position 4 of my ordered list; seed:59546c3aa388f15e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Final product name and logo (owner, phase 5). Devanagari labels inside the map canvas (Protomaps pre-shaped glyphs to be evaluated).
