/**
 * Builds the map's own GeoJSON layers from the raw sources in data/raw/.
 * Run with: pnpm map:build   (after pnpm map:download)
 *
 * Outputs (public/map/):
 *   nepal.geojson      national border, official 2020 map (dissolved from the provinces)
 *   mask.geojson       the world minus Nepal, used to fade everything outside the border
 *   provinces.geojson  7 provinces with current names in English and Nepali
 *   districts.geojson  77 districts, dissolved from local units
 *   highways.geojson   national highways (OSM ref NHxx), one feature per highway
 *
 * These files are for display. The authoritative copies (with 1 km segments) are
 * imported into PostGIS in PLAN task P0-11.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as turf from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, project } from "../../lib/map/preview-projection";
import { PALETTES, type MapTone } from "../../lib/map/style";
import { PROVINCES } from "../../lib/places/provinces";
import { canonicalDistrict, datasetDistrict, type NameRow } from "../../lib/places/districts";

const ROOT = join(import.meta.dirname, "..", "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "public", "map");
const GENERATED = join(ROOT, "lib", "map", "generated");

/** Rounds to 5 decimals (about 1 m), which is plenty for display and halves file size. */
const PRECISION = 5;
/** Simplification tolerance in degrees (about 50 m for borders, 30 m for roads). */
const BORDER_TOLERANCE = 0.0005;
const ROAD_TOLERANCE = 0.0003;

/**
 * Points that lie in Lipulekh, Kalapani and Limpiyadhura. The official 2020 map puts them
 * inside Nepal (Byas Rural Municipality, Darchula). If a data update ever moves them outside,
 * the build stops rather than publishing the wrong border.
 */
const OFFICIAL_MAP_CHECKS: Record<string, [number, number]> = {
  Gunji: [80.86, 30.1],
  Kuti: [80.77, 30.33],
  "Lipulekh approach": [81.0, 30.2],
};

// Current province names live in lib/places/provinces.ts (shared with the places import).

type AnyPoly = Feature<Polygon | MultiPolygon>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeGeoJson(name: string, fc: FeatureCollection, precision = PRECISION) {
  const path = join(OUT, name);
  const text = JSON.stringify(turf.truncate(fc, { precision, coordinates: 2 }));
  writeFileSync(path, text);
  console.log(`  ${name.padEnd(20)} ${fc.features.length.toString().padStart(4)} features  ${(text.length / 1024).toFixed(0)} KB`);
}

function unionAll(features: AnyPoly[]): AnyPoly {
  const merged = turf.union(turf.featureCollection(features));
  if (!merged) throw new Error("union produced no geometry");
  return merged;
}

/**
 * Removes slivers: polygon parts and holes smaller than `minKm2`. Unions of the source polygons
 * leave thin gaps and fragments where neighbouring edges don't quite meet; simplification would
 * otherwise collapse them into invalid rings. Nepal is landlocked, so no real part is this small.
 */
function dropSlivers(f: AnyPoly, label: string, minKm2 = 1): AnyPoly {
  const parts = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let droppedParts = 0;
  let droppedHoles = 0;
  const kept = parts.flatMap((rings) => {
    if (turf.area(turf.polygon([rings[0]])) / 1e6 < minKm2) {
      droppedParts++;
      return [];
    }
    const holes = rings.slice(1).filter((h) => {
      const keep = turf.area(turf.polygon([h])) / 1e6 >= minKm2;
      if (!keep) droppedHoles++;
      return keep;
    });
    return [[rings[0], ...holes]];
  });
  if (droppedParts || droppedHoles) {
    console.log(`  ${label}: dropped ${droppedParts} sliver part(s) and ${droppedHoles} sliver hole(s) under ${minKm2} km²`);
  }
  const geometry: Polygon | MultiPolygon =
    kept.length === 1 ? { type: "Polygon", coordinates: kept[0] } : { type: "MultiPolygon", coordinates: kept };
  return turf.feature(geometry, f.properties);
}

function simplify<T extends Feature>(f: T, tolerance: number): T {
  return turf.simplify(f, { tolerance, highQuality: false, mutate: false });
}

// ---------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------

function buildBoundaries() {
  const provincesRaw = readJson<FeatureCollection<Polygon | MultiPolygon>>(join(RAW, "okfn", "province.geojson"));
  const unitsRaw = readJson<FeatureCollection<Polygon | MultiPolygon>>(join(RAW, "okfn", "municipality.geojson"));

  const provinces = provincesRaw.features.map((f) => {
    const code = Number(f.properties?.PROVINCE);
    const names = PROVINCES[code];
    if (!names) throw new Error(`unknown province code ${code}`);
    return simplify(
      turf.feature(f.geometry, { code, name_en: names.en, name_np: names.np, slug: names.slug }),
      BORDER_TOLERANCE,
    );
  });
  if (provinces.length !== 7) throw new Error(`expected 7 provinces, got ${provinces.length}`);

  // Dissolve from the unsimplified provinces so shared edges cancel out cleanly.
  const nepal = dropSlivers(unionAll(provincesRaw.features), "Nepal");
  for (const [place, point] of Object.entries(OFFICIAL_MAP_CHECKS)) {
    if (!turf.booleanPointInPolygon(turf.point(point), nepal)) {
      throw new Error(`${place} ${point.join(",")} is outside the border: the data no longer follows the official 2020 map`);
    }
  }
  const nepalSimple = simplify(turf.feature(nepal.geometry, { name_en: "Nepal", name_np: "नेपाल" }), BORDER_TOLERANCE);

  // The world with Nepal cut out. Every outer ring of Nepal becomes a hole.
  const outerRings: Position[][] =
    nepalSimple.geometry.type === "Polygon"
      ? [nepalSimple.geometry.coordinates[0]]
      : nepalSimple.geometry.coordinates.map((p) => p[0]);
  const world: Position[] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const mask = turf.polygon([world, ...outerRings.map((r) => [...r].reverse())]);

  // Districts: group the 777 local-level polygons (including parks) by district.
  const byDistrict = new Map<string, AnyPoly[]>();
  for (const f of unitsRaw.features) {
    const d = String(f.properties?.DISTRICT);
    byDistrict.set(d, [...(byDistrict.get(d) ?? []), f]);
  }
  // Names and slugs shared with the database (lib/places/districts.ts), so links match.
  const namesPath = join(RAW, "names", "districts.en.json");
  const districtsEn = readJson<NameRow[]>(namesPath);
  const districtsNp = new Map(readJson<NameRow[]>(join(RAW, "names", "districts.np.json")).map((d) => [d.id, d.name]));
  const districts = [...byDistrict.entries()].map(([raw, parts]) => {
    const row = datasetDistrict(raw, districtsEn);
    const { nameEn: name_en, slug } = canonicalDistrict(row);
    const province = Number(parts[0].properties?.STATE_CODE);
    return simplify(
      turf.feature(dropSlivers(unionAll(parts), name_en).geometry, { name_en, name_np: districtsNp.get(row.id) ?? null, slug, province }),
      BORDER_TOLERANCE,
    );
  });
  if (districts.length !== 77) throw new Error(`expected 77 districts, got ${districts.length}`);

  writeGeoJson("nepal.geojson", turf.featureCollection([nepalSimple]));
  writeGeoJson("mask.geojson", turf.featureCollection([mask]));
  writeGeoJson("provinces.geojson", turf.featureCollection(provinces));
  writeGeoJson("districts.geojson", turf.featureCollection(districts));
  return nepal;
}

// ---------------------------------------------------------------------------
// National highways
// ---------------------------------------------------------------------------

interface OverpassWay {
  type: "way";
  id: number;
  tags: Record<string, string>;
  geometry: { lat: number; lon: number }[];
}

/**
 * Normalises an OSM ref to "NH01".."NH80". Returns null for refs that are not Nepal national
 * highways: Indian refs that leak in at the border (NH109D, NH327B) and local road codes (NH70-002).
 */
export function normaliseRef(raw: string): string | null {
  const m = /^NH0*(\d{1,2})$/.exec(raw.trim().toUpperCase().replace(/\s+/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 80 ? `NH${String(n).padStart(2, "0")}` : null;
}

function buildHighways(nepal: AnyPoly) {
  const { elements } = readJson<{ elements: OverpassWay[] }>(join(RAW, "osm", "nh_ways.json"));
  type Group = { lines: Position[][]; km: number; names: Map<string, number>; namesNp: Map<string, number> };
  const groups = new Map<string, Group>();
  const bump = (m: Map<string, number>, k?: string) => k && m.set(k, (m.get(k) ?? 0) + 1);

  for (const way of elements) {
    if (way.type !== "way" || way.geometry.length < 2) continue;
    const coords = way.geometry.map((p) => [p.lon, p.lat]);
    const line = turf.lineString(coords);
    // Keep only roads inside the official border (drops stray pieces across the frontier).
    const mid = turf.along(line, turf.length(line) / 2);
    if (!turf.booleanPointInPolygon(mid, nepal)) continue;
    // A dual carriageway is drawn as two one-way lines; count each side as half the length.
    const km = turf.length(line) * (way.tags.oneway === "yes" ? 0.5 : 1);

    for (const part of way.tags.ref.split(/[;,]/)) {
      const ref = normaliseRef(part);
      if (!ref) continue;
      const g: Group = groups.get(ref) ?? { lines: [], km: 0, names: new Map(), namesNp: new Map() };
      g.lines.push(coords);
      g.km += km;
      bump(g.names, way.tags["name:en"] ?? (/^[\x00-\x7f]+$/.test(way.tags.name ?? "") ? way.tags.name : undefined));
      bump(g.namesNp, way.tags["name:ne"] ?? (/[ऀ-ॿ]/.test(way.tags.name ?? "") ? way.tags.name : undefined));
      groups.set(ref, g);
    }
  }

  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const features: Feature<MultiLineString | LineString>[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, g]) =>
      simplify(
        turf.multiLineString(g.lines, {
          ref,
          num: Number(ref.slice(2)),
          name_en: top(g.names),
          name_np: top(g.namesNp),
          // Approximate: OSM coverage is uneven. Real lengths come from PostGIS (P0-11).
          length_km: Math.round(g.km),
        }),
        ROAD_TOLERANCE,
      ),
    );
  // 4 decimals (about 11 m) is enough for a road line and keeps the file light on 3G.
  writeGeoJson("highways.geojson", turf.featureCollection(features), 4);
}

// ---------------------------------------------------------------------------
// Static map renders (no map JavaScript outside /map, SPEC 6.2)
// ---------------------------------------------------------------------------

/**
 * SVG path data in the preview projection. `step` is the rounding in viewBox units: 1 unit is
 * about one screen pixel on the home hero; the light render is cropped and enlarged on inner
 * pages, so it keeps finer detail. Pieces that collapse to a point at that size are dropped.
 */
function svgPath(rings: Position[][], close: boolean, step = 1): string {
  const r = (v: number) => Math.round(v / step) * step;
  const fmt = (v: number) => (step >= 1 ? String(v) : v.toFixed(step >= 0.5 ? 1 : 2).replace(/\.?0+$/, ""));
  return rings
    .map((ring) => {
      const pts = ring.map(([lon, lat]) => project(lon, lat).map(r) as [number, number]);
      const kept = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
      if (kept.length < 2) return "";
      return `M${kept.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join("L")}${close ? "Z" : ""}`;
    })
    .join("");
}

function outlineRings(f: Feature<Polygon | MultiPolygon>): Position[][] {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
}

function buildRenders() {
  const nepal = readJson<FeatureCollection<Polygon | MultiPolygon>>(join(OUT, "nepal.geojson")).features[0];
  const highways = readJson<FeatureCollection<MultiLineString>>(join(OUT, "highways.geojson"));
  const vb = `0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`;

  const renders: { file: string; tone: MapTone; step: number; outlineTol: number; roadTol: number }[] = [
    { file: "base-ink.svg", tone: "ink", step: 1, outlineTol: 0.01, roadTol: 0.006 },
    { file: "base-light.svg", tone: "light", step: 0.25, outlineTol: 0.002, roadTol: 0.0015 },
  ];
  for (const r of renders) {
    const P = PALETTES[r.tone];
    const outline = svgPath(outlineRings(simplify(nepal, r.outlineTol)), true, r.step);
    const roads = svgPath(
      highways.features.flatMap((f) => simplify(f, r.roadTol).geometry.coordinates),
      false,
      r.step,
    );
    // Every highway in the lowest risk colour; pages draw coloured highways on top. Line widths
    // stay in screen pixels when a page crops and enlarges the render (non-scaling-stroke).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
<path d="${outline}" fill="${P.land}" stroke="${P.edge}" stroke-width="${P.edgeWidth}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<path d="${roads}" fill="none" stroke="${P.risk[0]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
</svg>`;
    writeFileSync(join(OUT, r.file), svg);
    console.log(`  ${r.file.padEnd(20)}            ${(svg.length / 1024).toFixed(0)} KB`);
  }

  // Per-highway paths, for drawing selected and risk-coloured highways over a base render.
  const paths: Record<string, string> = {};
  for (const f of highways.features) {
    paths[String(f.properties?.ref)] = svgPath(simplify(f, 0.003).geometry.coordinates, false, 0.5);
  }
  mkdirSync(GENERATED, { recursive: true });
  writeFileSync(join(GENERATED, "highway-paths.json"), JSON.stringify(paths));
  console.log(`  ${"highway-paths.json".padEnd(20)}            ${(JSON.stringify(paths).length / 1024).toFixed(0)} KB (lib/map/generated)`);

  // Per-district outlines for choropleths on the data page: about 1 km of detail is enough at
  // dashboard size and keeps the page light.
  const districtsFc = readJson<FeatureCollection<Polygon | MultiPolygon>>(join(OUT, "districts.geojson"));
  const districtPaths = districtsFc.features.map((f) => ({
    slug: String(f.properties?.slug),
    en: String(f.properties?.name_en),
    np: String(f.properties?.name_np ?? f.properties?.name_en),
    province: Number(f.properties?.province),
    d: svgPath(outlineRings(simplify(f, 0.01)), true, 1),
  }));
  writeFileSync(join(GENERATED, "district-paths.json"), JSON.stringify(districtPaths));
  console.log(`  ${"district-paths.json".padEnd(20)}            ${(JSON.stringify(districtPaths).length / 1024).toFixed(0)} KB (lib/map/generated)`);
}

/**
 * The faded city layer at the right edge of the hero and the full map (README "Faded city"):
 * real Kathmandu Valley streets from OSM, drawn black so the page can use it as a CSS mask
 * and colour it per surface.
 */
function buildCityLayer() {
  const path = join(RAW, "osm", "kathmandu_streets.json");
  let elements: OverpassWay[];
  try {
    ({ elements } = readJson<{ elements: OverpassWay[] }>(path));
  } catch {
    console.log("  kathmandu-streets.svg skipped: run pnpm map:download first");
    return;
  }
  // Fit the valley into a tall 400 x 800 frame, centred on Kathmandu.
  const [cx, cy] = [85.33, 27.7];
  const scaleX = 400 / 0.3 * Math.cos((27.7 * Math.PI) / 180);
  const scaleY = 800 / 0.2;
  const toXY = (lon: number, lat: number) => [
    Math.round(200 + (lon - cx) * scaleX),
    Math.round(400 - (lat - cy) * scaleY),
  ];
  const major = new Set(["trunk", "primary", "secondary"]);
  const groups: Record<"major" | "minor", string[]> = { major: [], minor: [] };
  for (const w of elements) {
    if (w.type !== "way" || !w.geometry || w.geometry.length < 2) continue;
    // Residential lanes make the file heavy for a faded texture; keep the street skeleton only.
    if (w.tags.highway === "residential") continue;
    const line = simplify(turf.lineString(w.geometry.map((p) => [p.lon, p.lat])), 0.00015);
    const pts = line.geometry.coordinates.map(([lon, lat]) => toXY(lon, lat));
    const kept = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (kept.length < 2) continue;
    groups[major.has(w.tags.highway) ? "major" : "minor"].push(`M${kept.map((p) => p.join(" ")).join("L")}`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
<path d="${groups.minor.join("")}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="0.8"/>
<path d="${groups.major.join("")}" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;
  writeFileSync(join(OUT, "kathmandu-streets.svg"), svg);
  console.log(`  ${"kathmandu-streets.svg".padEnd(20)}  ${elements.length} ways  ${(svg.length / 1024).toFixed(0)} KB`);
}

mkdirSync(OUT, { recursive: true });
console.log("Building map layers into public/map/");
const nepal = buildBoundaries();
buildHighways(nepal);
buildRenders();
buildCityLayer();
console.log("Done.");
