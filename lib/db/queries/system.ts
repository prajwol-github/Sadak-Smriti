import { sql } from "drizzle-orm";
import { defineQuery } from "./define";

/** For the health route (PLAN P0-13) and `pnpm db:migrate`'s final check. */
export const postgisVersion = defineQuery({
  name: "system/postgis-version",
  description: "PostGIS version string. Proves the database answers and PostGIS is installed.\nUsed by the health check.",
  example: {},
  build: (db) => db.execute<{ version: string }>(sql`select postgis_version() as version`),
});
