import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, smallint, integer, text, uuid } from "drizzle-orm/pg-core";
import { crashes } from "./crashes";
import { id, timestamps } from "./columns";

/**
 * People named in a crash (SPEC 10.3). Only what staff edit now: the memorial, media and family
 * claims come with their own tasks (PLAN P3). A person belongs to exactly one crash.
 *
 * Privacy (SPEC 2, 7.4): `nameVisibility = hidden` removes the name from every public page, export
 * and search; the person still counts in the crash's statistics. The slug is opaque ("p-" and
 * random hex), never made from the name, so a hidden name cannot leak through the address.
 */

export const personStatus = pgEnum("person_status", ["killed", "injured", "uninjured"]);
export const personSex = pgEnum("person_sex", ["female", "male", "other"]);
export const personRoadUser = pgEnum("person_road_user", ["driver", "passenger", "pedestrian", "rider", "pillion", "cyclist"]);
export const nameVisibility = pgEnum("name_visibility", ["public", "hidden"]);
export const personPublication = pgEnum("person_publication", ["draft", "published"]);

export const persons = pgTable("persons", {
  id: id(),
  crashId: uuid("crash_id").notNull().references(() => crashes.id, { onDelete: "restrict" }),
  slug: text("slug").notNull().unique(),
  status: personStatus("status").notNull(),
  nameEn: text("name_en"),
  nameNp: text("name_np"),
  age: smallint("age"),
  sex: personSex("sex"),
  roadUser: personRoadUser("road_user"),
  hometownText: text("hometown_text"),
  nameVisibility: nameVisibility("name_visibility").notNull().default("public"),
  publication: personPublication("publication").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  ...timestamps,
}, (t) => [
  index("persons_crash_idx").on(t.crashId),
  check("persons_age_range", sql`${t.age} is null or ${t.age} between 0 and 120`),
  check("persons_has_name", sql`${t.nameEn} is not null or ${t.nameNp} is not null`),
]);
