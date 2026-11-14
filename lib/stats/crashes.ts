import { cacheLife, cacheTag } from "next/cache";
import { ALL_CRASHES, type SampleCrash } from "@/lib/sample/data";
import { paginate, type Page } from "./paginate";

/** Crashes per page on the map's list. */
export const CRASH_PAGE_SIZE = 6;

/**
 * One page of crashes, newest first (PLAN P1-09 `lib/stats/map-queries.ts`).
 *
 * Sample data for now. The database version runs a COUNT and a LIMIT/OFFSET query here and keeps
 * the signature and the `Page` it returns, so the callers do not change. Each page number is its
 * own cache entry; the "crashes" tag is what the worker will purge when a crash changes.
 */
export async function listCrashes(page: number): Promise<Page<SampleCrash>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("crashes");
  const newestFirst = [...ALL_CRASHES].sort((a, b) => b.date.localeCompare(a.date));
  return paginate(newestFirst, page, CRASH_PAGE_SIZE);
}
