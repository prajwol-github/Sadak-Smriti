import { afterAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import { inRollback, testDb } from "@/lib/db/test-db";
import { REPORT_LIMITS, hitReportLimits, windows } from "./rate-limit";

/** ADR 0004 flood limits, against the real database (rolled back). Needs `pnpm db:up`. */
const { db, end } = testDb();
afterAll(() => end());

const NOW = new Date("2026-11-13T09:10:00Z");

describe("report flood limits", () => {
  it(`allows ${REPORT_LIMITS.perHour} reports an hour from one device and refuses the next`, async () => {
    const results = await inRollback(db, async (tx) => {
      const out = [];
      for (let i = 0; i < REPORT_LIMITS.perHour + 1; i++) out.push(await hitReportLimits(tx, "device-a", NOW));
      return out;
    });
    expect(results.slice(0, REPORT_LIMITS.perHour).every((r) => r.ok)).toBe(true);
    expect(results.at(-1)).toEqual({ ok: false, reason: "hour" });
  });

  it(`refuses the ${REPORT_LIMITS.perDay + 1}th report in a day even across hours`, async () => {
    const last = await inRollback(db, async (tx) => {
      let r;
      for (let i = 0; i <= REPORT_LIMITS.perDay; i++) {
        const t = new Date(NOW.getTime() + Math.floor(i / REPORT_LIMITS.perHour) * 3_600_000); // 3 per hour
        r = await hitReportLimits(tx, "device-b", t);
      }
      return r;
    });
    expect(last).toEqual({ ok: false, reason: "day" });
  });

  it(`accepts the ${REPORT_LIMITS.sitePerDay}th report of the day and stops everyone after it`, async () => {
    // Start the site counter one short of the cap, instead of making 300 round trips (that took
    // 4–5 s, right at the test timeout). The counting itself is covered by the per-device tests.
    const [last, over] = await inRollback(db, async (tx) => {
      await tx.execute(q`insert into rate_limits (key, window_start, count) values ('report:site:day', ${windows(NOW).day.toISOString()}::timestamptz, ${REPORT_LIMITS.sitePerDay - 1})`);
      return [await hitReportLimits(tx, "device-x", NOW), await hitReportLimits(tx, "device-y", NOW)];
    });
    expect(last).toEqual({ ok: true });
    expect(over).toEqual({ ok: false, reason: "site" });
  });

  it("counts devices separately", async () => {
    const r = await inRollback(db, async (tx) => {
      for (let i = 0; i < REPORT_LIMITS.perHour; i++) await hitReportLimits(tx, "device-c", NOW);
      return hitReportLimits(tx, "device-d", NOW);
    });
    expect(r).toEqual({ ok: true });
  });
});
