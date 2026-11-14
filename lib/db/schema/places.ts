import { index, integer, pgEnum, pgTable, smallint, text, uuid } from "drizzle-orm/pg-core";
import { id, multiPolygon, timestamps } from "./columns";

/**
 * Places (SPEC 10.1, PLAN P0-07). Reference data, loaded by `pnpm db:places`:
 * boundaries from Open Knowledge Nepal (official 2020 map, CC BY 4.0) and Nepali/English names
 * from sagautam5/local-states-nepal (MIT). See docs/adr/0002-map-sources.md.
 *
 * `code` is the names dataset's id, stable across imports, so re-running the import updates
 * rows in place instead of creating new ones.
 */

export const provinces = pgTable("provinces", {
  id: id(),
  code: smallint("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameNp: text("name_np").notNull(),
  geom: multiPolygon("geom").notNull(),
  ...timestamps,
}, (t) => [index("provinces_geom_gist").using("gist", t.geom)]);

export const districts = pgTable("districts", {
  id: id(),
  provinceId: uuid("province_id").notNull().references(() => provinces.id, { onDelete: "restrict" }),
  code: smallint("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameNp: text("name_np").notNull(),
  /** Union of the district's local units and any national park or reserve inside it. */
  geom: multiPolygon("geom").notNull(),
  ...timestamps,
}, (t) => [
  index("districts_geom_gist").using("gist", t.geom),
  index("districts_province_idx").on(t.provinceId),
]);

export const localUnitType = pgEnum("local_unit_type", ["metro", "sub_metro", "municipality", "rural"]);

export const localUnits = pgTable("local_units", {
  id: id(),
  districtId: uuid("district_id").notNull().references(() => districts.id, { onDelete: "restrict" }),
  code: smallint("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameNp: text("name_np").notNull(),
  type: localUnitType("type").notNull(),
  wards: integer("wards").notNull(),
  geom: multiPolygon("geom").notNull(),
  ...timestamps,
}, (t) => [
  index("local_units_geom_gist").using("gist", t.geom),
  index("local_units_district_idx").on(t.districtId),
]);
