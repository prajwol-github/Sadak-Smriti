import { asc, sql } from "drizzle-orm";
import { districts, localUnits, provinces } from "../schema";
import { defineQuery } from "./define";

/**
 * GeoJSON (Polygon or MultiPolygon, WGS 84) → a valid MultiPolygon. ST_UnaryUnion dissolves
 * internal edges, so a district made of many local-unit polygons becomes one shape.
 */
const multiPolygonFrom = (geojson: string) =>
  sql`ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326))), 3))`;

const EXAMPLE_GEOJSON = '{"type":"Polygon","coordinates":[[[85.3,27.7],[85.31,27.7],[85.31,27.71],[85.3,27.7]]]}';

// --- Import (pnpm db:places) ----------------------------------------------------------------

export const upsertProvince = defineQuery({
  name: "places/upsert-province",
  description: "Inserts or updates one province by its code. Used only by the places import.",
  example: { code: 3, slug: "bagmati", nameEn: "Bagmati", nameNp: "बागमती", geojson: EXAMPLE_GEOJSON },
  build: (db, a: { code: number; slug: string; nameEn: string; nameNp: string; geojson: string }) =>
    db
      .insert(provinces)
      .values({ code: a.code, slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, geom: multiPolygonFrom(a.geojson) })
      .onConflictDoUpdate({
        target: provinces.code,
        set: { slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, geom: multiPolygonFrom(a.geojson), updatedAt: sql`now()` },
      })
      .returning({ id: provinces.id }),
});

export const upsertDistrict = defineQuery({
  name: "places/upsert-district",
  description: "Inserts or updates one district by its code. Used only by the places import.",
  example: { provinceId: "00000000-0000-7000-8000-000000000003", code: 27, slug: "kathmandu", nameEn: "Kathmandu", nameNp: "काठमाडौं", geojson: EXAMPLE_GEOJSON },
  build: (db, a: { provinceId: string; code: number; slug: string; nameEn: string; nameNp: string; geojson: string }) =>
    db
      .insert(districts)
      .values({ provinceId: a.provinceId, code: a.code, slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, geom: multiPolygonFrom(a.geojson) })
      .onConflictDoUpdate({
        target: districts.code,
        set: { provinceId: a.provinceId, slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, geom: multiPolygonFrom(a.geojson), updatedAt: sql`now()` },
      })
      .returning({ id: districts.id }),
});

type LocalUnitType = (typeof localUnits.$inferInsert)["type"];

export const upsertLocalUnit = defineQuery({
  name: "places/upsert-local-unit",
  description: "Inserts or updates one local unit by its code. Used only by the places import.",
  example: {
    districtId: "00000000-0000-7000-8000-000000000027", code: 300, slug: "kathmandu-kathmandu",
    nameEn: "Kathmandu", nameNp: "काठमाडौं", type: "metro" as LocalUnitType, wards: 32, geojson: EXAMPLE_GEOJSON,
  },
  build: (db, a: { districtId: string; code: number; slug: string; nameEn: string; nameNp: string; type: LocalUnitType; wards: number; geojson: string }) =>
    db
      .insert(localUnits)
      .values({ districtId: a.districtId, code: a.code, slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, type: a.type, wards: a.wards, geom: multiPolygonFrom(a.geojson) })
      .onConflictDoUpdate({
        target: localUnits.code,
        set: { districtId: a.districtId, slug: a.slug, nameEn: a.nameEn, nameNp: a.nameNp, type: a.type, wards: a.wards, geom: multiPolygonFrom(a.geojson), updatedAt: sql`now()` },
      }),
});

export const countPlaces = defineQuery({
  name: "places/count",
  description: "How many provinces, districts and local units are loaded. The import checks 7 / 77 / 753.",
  example: {},
  build: (db) =>
    db.execute<{ provinces: number; districts: number; local_units: number }>(
      sql`select (select count(*)::int from provinces) as provinces, (select count(*)::int from districts) as districts, (select count(*)::int from local_units) as local_units`,
    ),
});

// --- App ------------------------------------------------------------------------------------

export const listDistricts = defineQuery({
  name: "places/districts",
  description: "All 77 districts with both names, for the district select on the report form.\nThe page sorts them in the visitor's language.",
  example: {},
  build: (db) =>
    db
      .select({ id: districts.id, slug: districts.slug, nameEn: districts.nameEn, nameNp: districts.nameNp, provinceCode: provinces.code })
      .from(districts)
      .innerJoin(provinces, sql`${provinces.id} = ${districts.provinceId}`)
      .orderBy(asc(districts.nameEn)),
});

export const listLocalUnits = defineQuery({
  name: "places/local-units",
  description: "Local units of one district, for the optional local-unit select on the report form.",
  example: { districtId: "00000000-0000-7000-8000-000000000027" },
  build: (db, a: { districtId: string }) =>
    db
      .select({ id: localUnits.id, nameEn: localUnits.nameEn, nameNp: localUnits.nameNp, type: localUnits.type })
      .from(localUnits)
      .where(sql`${localUnits.districtId} = ${a.districtId}`)
      .orderBy(asc(localUnits.nameEn)),
});

export const locatePoint = defineQuery({
  name: "places/locate-point",
  description:
    "Which district and local unit contain a point (longitude, latitude). No row means the point is\noutside Nepal's official border. The local unit is null inside a national park or reserve.",
  example: { lon: 85.324, lat: 27.7172 },
  build: (db, a: { lon: number; lat: number }) =>
    db.execute<{ district_id: string; district_en: string; district_np: string; local_unit_id: string | null; local_unit_en: string | null; local_unit_np: string | null }>(sql`
      select d.id as district_id, d.name_en as district_en, d.name_np as district_np,
             lu.id as local_unit_id, lu.name_en as local_unit_en, lu.name_np as local_unit_np
      from districts d
      left join local_units lu
        on lu.district_id = d.id and ST_Covers(lu.geom, ST_SetSRID(ST_MakePoint(${a.lon}, ${a.lat}), 4326))
      where ST_Covers(d.geom, ST_SetSRID(ST_MakePoint(${a.lon}, ${a.lat}), 4326))
      limit 1`),
});
