# 0002: Map sources and the national border

Date: 13 Nov 2026. Status: accepted.

## Context

The owner decided the map must show Nepal's border as in the official map published by the Survey Department in May 2020, with Lipulekh, Kalapani and Limpiyadhura inside Nepal, drawn solid (no "disputed" line). OpenStreetMap's border, and the border lines in basemaps built from it, do not follow that map.

## Decision

- **Border, provinces, districts, local units:** Open Knowledge Nepal, `okfnepal/localboundaries`, republished from the Survey Department, licence CC BY 4.0. Pinned to commit `54f496a` in `scripts/map/download-sources.sh`.
  - Checked by geometry, not by description: Gunji (30.10 N, 80.86 E), Kuti (30.33 N, 80.77 E) and the Lipulekh approach fall inside Byas Rural Municipality, Darchula. `scripts/map/build-map-data.ts` stops the build if any of them ever falls outside.
- **National highways:** OpenStreetMap ways with `ref=NH..` (Overpass), ODbL. Refs are normalised to `NH01`–`NH80`; Indian refs that leak across the border (`NH109D`, `NH327B`) and local codes (`NH70-002`) are dropped.
- **Basemap (land, water, roads, places):** a Protomaps daily build cut to Nepal's bounding box with `pmtiles extract` (Docker image `protomaps/go-pmtiles:v1.31.2`), z0–14, about 330 MB, served from our own server by range requests. Its `boundaries` layer is **never drawn**; our own border and an outside-Nepal mask are drawn instead.
- Attribution on every map: "Boundaries: Survey Department via Open Knowledge Nepal (CC BY 4.0) · © OpenStreetMap contributors".

## Consequences

- The source data has 755 local-unit polygons against the official 753; reconcile in PLAN P0-07. *(Resolved 13 Nov 2026, see "Names" below.)*
- The source has no Nepali names; P0-07 must add them from another official list. *(Resolved 13 Nov 2026, see "Names" below.)*
- Province names in the source are partly pre-2022 ("Province No 1"); the build maps them to current names.
- Highway lengths from OSM are approximate (uneven mapping, dual carriageways). Real lengths and 1 km segments come from the PostGIS import (P0-11).
- MapLibre cannot shape Devanagari by itself. The Protomaps build ships a pre-shaped Devanagari glyph font (`pgf:devanagari:name`); evaluate it for in-map Nepali labels before falling back to HTML labels.

## Names of provinces, districts and local units (added 13 Nov 2026, PLAN P0-07)

- **Source:** `sagautam5/local-states-nepal`, MIT licence, copyright (c) 2020 Sagar Gautam. Pinned to commit `035cb3d` in `scripts/db/download-place-names.sh`. It lists 7 provinces, 77 districts and 753 local units with Nepali and English names, type and ward count. Its MIT notice is kept with the downloaded data and must be reproduced wherever the names are redistributed (the open-data downloads, P4-05).
- **Province names** come from our own checked list (`lib/places/provinces.ts`), not this dataset: its Nepali "Koshi" uses a malformed vowel sequence.
- **755 vs 753, reconciled.** The boundary file has 777 polygons: 755 are local units, because Bansagadhi (Bardiya) and Binayee Tribeni (Nawalpur) each come in two parts. The other 22 are national parks, reserves and the Lumbini development area. Grouped by name, that is exactly 753. Parks and reserves are part of their district's shape but not of any local unit.
- **Matching** (`lib/places/match.ts`, `pnpm db:places`): 13 district spellings differ and are mapped by hand in the import. Local units are matched per district: 587 exactly, 151 by spelling rules or similarity, 10 as renamed units (the only one left in their district) and 5 by area. Every non-exact match is listed in `docs/data/place-name-matches.csv` for review. The renamed and area-matched units agree with the dataset's official area to within 0.4%.
- **The dataset's areas are unreliable** as a check: Byas (Darchula) is 1,195 km² on the 2020 map but 839 km² in the dataset (probably the area before the 2020 map; not confirmed), and some Dolpa units differ ten-fold. Areas are reported for review, never used to reject a name match.
- **English spellings** of local units are the dataset's, which has a few typos (for example "Budhalikantha" for Budhanilkantha, "Ratnagar" for Ratnanagar). District typos are fixed in the import (Achham, Panchthar, Parbat, Ramechhap). Fixing the local-unit typos, and keeping both spellings as search aliases, belongs to the `place_aliases` table (SPEC 10.1).
- **Checked in the database:** 7 / 77 / 753 rows; 6 metropolitan, 11 sub-metropolitan, 276 municipalities and 460 rural municipalities (the official counts); all geometries valid; a point in central Kathmandu resolves to Kathmandu; a point in India resolves to nothing; Gunji (Lipulekh) resolves to Byas, Darchula.
