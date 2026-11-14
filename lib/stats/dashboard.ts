import { cacheLife, cacheTag } from "next/cache";
import districtPaths from "@/lib/map/generated/district-paths.json";
import { DASHBOARD, DASHBOARD_MORE, dashboardDistricts } from "@/lib/sample/data";

/**
 * Research dashboard numbers (SPEC 9.2), one function per dashboard module so each module loads,
 * caches and fails on its own (PLAN P4-02 puts the real queries behind these same names).
 *
 * Sample data for now. Every function here is cached for an hour and carries the "stats" tag, which
 * the stats refresh job will purge when the numbers change. Each returns plain data: no class
 * instances, no functions, so the cache can store it. Do not read cookies, headers or
 * searchParams in here; pass them in as arguments, which then become part of the cache key.
 */

export async function getKpis() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.kpis;
}

export async function getMonthly() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.months;
}

export async function getProvinces() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.provinces;
}

/** Killed per district, sorted most first. One entry shared by the map and the top-districts list. */
export async function getDistricts() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  const values = dashboardDistricts(districtPaths);
  return districtPaths.map((d) => ({ slug: d.slug, en: d.en, np: d.np, killed: values[d.slug] ?? 0 })).sort(
    (a, b) => b.killed - a.killed,
  );
}

export async function getVehicles() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.vehicles;
}

export async function getCrashTypes() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.crashTypes;
}

export async function getRoadUsers() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.roadUsers;
}

export async function getTimeOfDay() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD_MORE.byTime;
}

export async function getWeekdays() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD_MORE.byWeekday;
}

export async function getAgeSex() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.ages;
}

export async function getCauses() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD_MORE.causes;
}

export async function getCrashSizes() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD_MORE.crashSizes;
}

export async function getHighways() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD_MORE.highways;
}

export async function getPoliceCoverage() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  return DASHBOARD.coverage;
}
