import { lt, sql } from "drizzle-orm";
import { rateLimits } from "../schema";
import { defineQuery } from "./define";

/** Counts one more event in a fixed window and returns the new total (atomic; no Redis needed). */
export const hitRateLimit = defineQuery({
  name: "rate-limit/hit",
  description: "Adds one to a flood-limit counter and returns the new count (lib/net/rate-limit.ts).\nOne row per key and window; concurrent requests are counted correctly.",
  example: { key: "report:ip:hour:0f3a…", windowStart: new Date("2026-11-13T09:00:00Z") },
  build: (db, a: { key: string; windowStart: Date }) =>
    db
      .insert(rateLimits)
      .values({ key: a.key, windowStart: a.windowStart, count: 1 })
      .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
      .returning({ count: rateLimits.count }),
});

/** SPEC 12.3: IP hashes are kept 30 days. Run daily by the worker (lib/maintenance/retention.ts). */
export const purgeRateLimits = defineQuery({
  name: "maintenance/purge-rate-limits",
  description: "Deletes flood-limit counters older than the given time (30 days, SPEC 12.3).",
  example: { before: new Date("2026-10-14T00:00:00Z") },
  build: (db, a: { before: Date }) => db.delete(rateLimits).where(lt(rateLimits.windowStart, a.before)).returning({ key: rateLimits.key }),
});
