import { sql } from "drizzle-orm";
import { check, customType, date, index, integer, pgEnum, pgTable, primaryKey, text, time, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { districts, localUnits, provinces } from "./places";

/**
 * Crashes, vehicles and sources (SPEC 10.2, 10.4). Only the columns the report form needs now;
 * later tasks add columns with new migrations (PLAN rule 8). Checks follow SPEC 10.7.
 */

/** PostGIS geography point (WGS 84). Written with ST_MakePoint in queries. */
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType: () => "geography(Point, 4326)",
});

export const crashStatus = pgEnum("crash_status", ["draft", "pending", "published", "rejected", "merged"]);
export const locationPrecision = pgEnum("location_precision", ["exact", "place", "local_unit", "district"]);
export const createdVia = pgEnum("created_via", ["news", "contributor", "tip", "import"]);
export const verificationLevel = pgEnum("verification_level", [
  "single_source", "multi_source", "reviewer_verified", "family_confirmed", "police_matched",
]);
export const vehicleType = pgEnum("vehicle_type", [
  "bus", "microbus", "jeep", "car", "truck", "tipper", "tanker", "tractor", "motorcycle", "scooter", "e_rickshaw", "bicycle", "other",
]);
export const sourceKind = pgEnum("source_kind", ["news", "police", "social", "witness", "other"]);
export const crashSourceRelation = pgEnum("crash_source_relation", ["report", "follow_up", "roundup", "other"]);

export const crashes = pgTable("crashes", {
  id: id(),
  slug: text("slug").notNull().unique(),
  status: crashStatus("status").notNull().default("draft"),
  mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => crashes.id, { onDelete: "restrict" }),
  titleEn: text("title_en"),
  titleNp: text("title_np"),
  occurredOn: date("occurred_on").notNull(),
  occurredTime: time("occurred_time"),
  location: geographyPoint("location"),
  locationPrecision: locationPrecision("location_precision").notNull().default("district"),
  placeNameEn: text("place_name_en"),
  placeNameNp: text("place_name_np"),
  provinceId: uuid("province_id").notNull().references(() => provinces.id, { onDelete: "restrict" }),
  districtId: uuid("district_id").notNull().references(() => districts.id, { onDelete: "restrict" }),
  localUnitId: uuid("local_unit_id").references(() => localUnits.id, { onDelete: "restrict" }),
  deaths: integer("deaths").notNull(),
  injuredTotal: integer("injured_total"),
  createdVia: createdVia("created_via").notNull(),
  verificationLevel: verificationLevel("verification_level").notNull().default("single_source"),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (t) => [
  index("crashes_district_date_idx").on(t.districtId, t.occurredOn),
  index("crashes_location_gist").using("gist", t.location),
  check("crashes_deaths_nonnegative", sql`${t.deaths} >= 0`),
  check("crashes_injured_nonnegative", sql`${t.injuredTotal} is null or ${t.injuredTotal} >= 0`),
  // Not in the future, in Nepal's calendar day (SPEC 7.1, 10.7). Checked on every write.
  check("crashes_not_future", sql`${t.occurredOn} <= (now() at time zone 'Asia/Kathmandu')::date`),
]);

export const crashVehicles = pgTable("crash_vehicles", {
  id: id(),
  crashId: uuid("crash_id").notNull().references(() => crashes.id, { onDelete: "restrict" }),
  type: vehicleType("type").notNull(),
  ...timestamps,
}, (t) => [index("crash_vehicles_crash_idx").on(t.crashId)]);

export const sources = pgTable("sources", {
  id: id(),
  kind: sourceKind("kind").notNull(),
  url: text("url"),
  normalizedUrl: text("normalized_url").unique(),
  title: text("title"),
  /** Witness statements and (later) article text. Never shown publicly (SPEC 7.1, 7.2). */
  textPrivate: text("text_private"),
  ...timestamps,
});

export const crashSources = pgTable("crash_sources", {
  crashId: uuid("crash_id").notNull().references(() => crashes.id, { onDelete: "restrict" }),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  relation: crashSourceRelation("relation").notNull().default("report"),
  ...timestamps,
}, (t) => [primaryKey({ columns: [t.crashId, t.sourceId] })]);
