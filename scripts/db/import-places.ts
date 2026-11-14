/**
 * pnpm db:places [--dry-run]
 *
 * Loads provinces, districts and local units (PLAN P0-07):
 *   boundaries  data/raw/okfn/      Open Knowledge Nepal, official 2020 map, CC BY 4.0 (pnpm map:download)
 *   names       data/raw/names/     sagautam5/local-states-nepal, MIT (pnpm db:places:download)
 *
 * The two sources spell many names differently, so local units are matched per district by
 * lib/places/match.ts. Every match that is not an exact spelling is written to
 * docs/data/place-name-matches.csv for people to review. The import stops if anything is left
 * unmatched, and checks 7 / 77 / 753 at the end. Runs as `migrator`; safe to re-run (upserts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../lib/db/schema";
import type { Executor } from "../../lib/db/queries/define";
import { countPlaces, locatePoint, upsertDistrict, upsertLocalUnit, upsertProvince } from "../../lib/db/queries/places";
import { matchDistrict, type Boundary, type Match, type NamedUnit } from "../../lib/places/match";
import { DISTRICT_EN_FIXES, canonicalDistrict, datasetDistrict, slugify } from "../../lib/places/districts";
import { PROVINCES } from "../../lib/places/provinces";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // CI sets the variables directly.
}

const DRY = process.argv.includes("--dry-run");

interface NameRow { id: number; name: string; province_id?: number; district_id?: number; category_id?: number; area_sq_km?: string; wards?: string }
const json = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const names = (kind: string, lang: "en" | "np") => json<NameRow[]>(`data/raw/names/${kind}.${lang}.json`);


const UNIT_TYPES = { 1: "metro", 2: "sub_metro", 3: "municipality", 4: "rural" } as const;
const LOCAL_UNIT_KINDS = new Set(["Gaunpalika", "Nagarpalika", "Upamahanagarpalika", "Mahanagarpalika"]);


function polygonsOf(f: Feature<Polygon | MultiPolygon>): Position[][][] {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}
const multi = (polys: Position[][][]): MultiPolygon => ({ type: "MultiPolygon", coordinates: polys });
const areaKm2 = (g: MultiPolygon) => turf.area(g) / 1e6;

// --- Read and match ---------------------------------------------------------------------------

const unitsFc = json<FeatureCollection<Polygon | MultiPolygon>>("data/raw/okfn/municipality.geojson");
const provincesFc = json<FeatureCollection<Polygon | MultiPolygon>>("data/raw/okfn/province.geojson");
const dEn = names("districts", "en");
const dNp = new Map(names("districts", "np").map((d) => [d.id, d.name]));
const mEn = names("municipalities", "en");
const mNp = new Map(names("municipalities", "np").map((m) => [m.id, m.name]));


// Group polygons by district; local units also by name (two units come in two parts each).
interface DistrictGroup { row: NameRow; okfnProvince: number; all: Position[][][]; units: Map<string, Position[][][]> }
const groups = new Map<number, DistrictGroup>();
for (const f of unitsFc.features) {
  // STATE_CODE is the province number; the "Province" field mixes numbers and names.
  const p = f.properties as { DISTRICT: string; GaPa_NaPa: string; Type_GN: string; STATE_CODE: number };
  const row = datasetDistrict(p.DISTRICT, dEn);
  const g: DistrictGroup = groups.get(row.id) ?? { row, okfnProvince: Number(p.STATE_CODE), all: [], units: new Map() };
  groups.set(row.id, g);
  g.all.push(...polygonsOf(f));
  if (LOCAL_UNIT_KINDS.has(p.Type_GN)) {
    g.units.set(p.GaPa_NaPa, [...(g.units.get(p.GaPa_NaPa) ?? []), ...polygonsOf(f)]);
  }
}

const problems: string[] = [];
/** Area differences are reported, not fatal: the names dataset's areas predate the 2020 map
 *  (Byas, Darchula) or are simply wrong in places (Shey Phoksundo). */
const areaWarnings: string[] = [];
const report: string[] = ["district,boundary_name,dataset_name,dataset_code,stage,area_ratio"];
const matched: { district: DistrictGroup; match: Match; geom: MultiPolygon }[] = [];

for (const g of [...groups.values()].sort((a, b) => a.row.id - b.row.id)) {
  if (g.row.province_id !== g.okfnProvince) {
    problems.push(`${g.row.name}: province ${g.okfnProvince} in the boundaries but ${g.row.province_id} in the names`);
  }
  const geoms = new Map([...g.units].map(([n, polys]) => [n, multi(polys)]));
  const boundaries: Boundary[] = [...geoms].map(([name, geom]) => ({ name, area: areaKm2(geom) }));
  const units: NamedUnit[] = mEn
    .filter((m) => m.district_id === g.row.id)
    .map((m) => ({ code: m.id, name: m.name, area: Number(m.area_sq_km) }));

  const { matches, unmatched } = matchDistrict(boundaries, units);
  for (const m of matches) {
    matched.push({ district: g, match: m, geom: geoms.get(m.boundary.name)! });
    if (m.stage !== "exact") {
      report.push([g.row.name, m.boundary.name, m.unit.name, m.unit.code, m.stage, m.areaRatio.toFixed(3)].map((v) => `"${v}"`).join(","));
    }
    if (m.areaRatio < 0.75 || m.areaRatio > 1.33) {
      areaWarnings.push(`${g.row.name}: ${m.boundary.name} ↔ ${m.unit.name} areas differ (ratio ${m.areaRatio.toFixed(2)})`);
    }
  }
  for (const b of unmatched.boundaries) problems.push(`${g.row.name}: boundary "${b.name}" (${b.area.toFixed(0)} km²) has no name`);
  for (const u of unmatched.units) problems.push(`${g.row.name}: name "${u.name}" (${u.area} km²) has no boundary`);
}

mkdirSync("docs/data", { recursive: true });
writeFileSync("docs/data/place-name-matches.csv", report.join("\n") + "\n");

const byStage = matched.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.match.stage]: (acc[m.match.stage] ?? 0) + 1 }), {});
console.log(`Districts: ${groups.size}. Local units matched: ${matched.length} (${JSON.stringify(byStage)}).`);
console.log(`Review file: docs/data/place-name-matches.csv (${report.length - 1} non-exact matches).`);
if (areaWarnings.length) {
  console.log(`\n${areaWarnings.length} area difference(s), listed for review (not fatal):\n  ${areaWarnings.join("\n  ")}`);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
if (matched.length !== 753 || groups.size !== 77) {
  console.error(`Expected 77 districts and 753 local units.`);
  process.exit(1);
}
if (DRY) {
  console.log("Dry run: nothing written.");
  process.exit(0);
}

// --- Write --------------------------------------------------------------------------------------

async function write(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema }) as unknown as Executor;
  try {
    await (db as unknown as { transaction: (fn: (tx: Executor) => Promise<void>) => Promise<void> }).transaction(async (tx) => {
      const provinceIds = new Map<number, string>();
      for (const f of provincesFc.features) {
        const code = Number((f.properties as { PROVINCE: number }).PROVINCE);
        const p = PROVINCES[code];
        const [row] = await upsertProvince.build(tx, { code, slug: p.slug, nameEn: p.en, nameNp: p.np, geojson: JSON.stringify(multi(polygonsOf(f))) });
        provinceIds.set(code, row.id);
      }

      const districtIds = new Map<number, string>();
      for (const g of groups.values()) {
        const { nameEn, slug } = canonicalDistrict(g.row);
        const [row] = await upsertDistrict.build(tx, {
          provinceId: provinceIds.get(g.row.province_id!)!,
          code: g.row.id, slug, nameEn, nameNp: dNp.get(g.row.id)!,
          geojson: JSON.stringify(multi(g.all)),
        });
        districtIds.set(g.row.id, row.id);
      }

      for (const { district, match, geom } of matched) {
        const m = mEn.find((x) => x.id === match.unit.code)!;
        const nameEn = m.name;
        await upsertLocalUnit.build(tx, {
          districtId: districtIds.get(district.row.id)!,
          code: m.id,
          slug: `${slugify(DISTRICT_EN_FIXES[district.row.name] ?? district.row.name)}-${slugify(nameEn)}`,
          nameEn, nameNp: mNp.get(m.id)!,
          type: UNIT_TYPES[m.category_id as 1 | 2 | 3 | 4],
          wards: Number(m.wards),
          geojson: JSON.stringify(geom),
        });
      }
    });

    const [counts] = await countPlaces.build(db, {});
    console.log(`Loaded: ${counts.provinces} provinces, ${counts.districts} districts, ${counts.local_units} local units.`);
    const [ktm] = await locatePoint.build(db, { lon: 85.324, lat: 27.7172 });
    console.log(`Check, central Kathmandu → ${ktm?.local_unit_en ?? "none"}, ${ktm?.district_en ?? "none"}`);
    const india = await locatePoint.build(db, { lon: 83.0, lat: 26.0 });
    console.log(`Check, a point in India → ${india.length ? "FOUND (wrong)" : "outside Nepal"}`);
    if (counts.provinces !== 7 || counts.districts !== 77 || counts.local_units !== 753 || !ktm || india.length) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) {
  console.error("MIGRATOR_DATABASE_URL is not set");
  process.exit(1);
}
void write(url);
