import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { KpiSkeleton, Row, Slot } from "@/components/data/layout";
import {
  AgeSex, Causes, CrashSizes, CrashTypeBars, DeadliestHighways, DistrictMap, KpiStrip, MonthTrend, PoliceComparison,
  ProvinceBars, RoadUserBars, TimeOfDay, TopDistricts, VehicleBars, Weekdays,
} from "@/components/data/modules";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { fmtNum, type Locale } from "@/lib/format";
import { DASHBOARD } from "@/lib/sample/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Data");
  return { title: t("metaTitle") };
}

/**
 * Research dashboard (design handoff screen 6, SPEC 9.2). Sample data until PLAN P4-02 / P4-04.
 *
 * The page itself is only a shell: headings, the filter rail and the layout. Every number comes
 * from a module in components/data/modules.tsx that loads its own cached data from lib/stats and
 * sits in its own <Suspense> with a skeleton (`Slot`). A slow or failing query therefore only
 * holds back its own panel. Filters and downloads need real records, so they are shown disabled
 * (PLAN rule 13).
 */
export default async function DataPage() {
  const t = await getTranslations("Data");
  const locale = (await getLocale()) as Locale;
  const n = (v: number) => fmtNum(v, locale);

  const filters = [
    [t("period"), t("periodValue")], [t("province"), t("provinceAll")], [t("district"), t("districtAll")],
    [t("highway"), t("highwayAll")], [t("vehicle"), t("vehicleAll")], [t("crashType"), t("crashTypeAll")],
  ];

  return (
    <>
      <SiteNav current="data" />
      <main id="content">
        <header className="border-b-2 border-ink px-4 py-8 lg:px-8 lg:py-10">
          <h1 className="text-[36px] lg:text-[48px]">{t("heading")}</h1>
          <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("intro")}</p>
        </header>

        <div className="lg:grid lg:grid-cols-[280px_1fr]">
          {/* Filters and downloads */}
          <aside className="border-b-2 border-ink lg:border-b-0 lg:border-r-2">
            <details className="group lg:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 [&::-webkit-details-marker]:hidden">
                <span className="text-ui">{t("filterSummary")}</span>
                <span className="bg-ink px-3.5 py-2.5 text-small font-extrabold text-bg">{t("filtersButton", { count: n(0) })}</span>
              </summary>
              <div className="border-t border-neutral-400 px-4 pb-6 pt-4"><FilterRail t={t} filters={filters} /></div>
            </details>
            <div className="hidden px-6 py-7 lg:block"><FilterRail t={t} filters={filters} /></div>
          </aside>

          <div className="min-w-0">
            <Suspense fallback={<KpiSkeleton />}><KpiStrip /></Suspense>

            <Row cols="xl:grid-cols-[2fr_1fr]">
              <Slot title={t("byMonth")} height={220}><MonthTrend /></Slot>
              <Slot title={t("byProvince")} height={220}><ProvinceBars /></Slot>
            </Row>

            <Row cols="xl:grid-cols-[1.6fr_1fr]">
              <Slot title={t("byDistrict")} height={360}><DistrictMap /></Slot>
              <Slot title={t("topDistricts")} height={360}><TopDistricts /></Slot>
            </Row>

            <Row cols="md:grid-cols-2 xl:grid-cols-3">
              <Slot title={t("byVehicle")} height={200}><VehicleBars /></Slot>
              <Slot title={t("byCrashType")} height={200}><CrashTypeBars /></Slot>
              <Slot title={t("byRoadUser")} height={200}><RoadUserBars /></Slot>
            </Row>

            <Row cols="md:grid-cols-2 xl:grid-cols-3">
              <Slot title={t("timeOfDay")} height={130}><TimeOfDay /></Slot>
              <Slot title={t("byWeekday")} height={130}><Weekdays /></Slot>
              <Slot title={t("ageSex")} height={220}><AgeSex /></Slot>
            </Row>

            <Row cols="xl:grid-cols-2">
              <Slot title={t("causes")} height={240}><Causes /></Slot>
              <Slot title={t("crashSize")} height={150}><CrashSizes /></Slot>
            </Row>

            <Row cols="xl:grid-cols-2" last>
              <Slot title={t("highways")} height={240}><DeadliestHighways /></Slot>
              <Slot title={t("vsPolice")} height={200}><PoliceComparison /></Slot>
            </Row>

            <section className="border-t-2 border-ink bg-surface px-4 py-6 lg:px-8">
              <h2 className="text-h4">{t("coverageTitle")}</h2>
              <p className="mt-2 max-w-[80ch] text-ui">{t("coverageBody")}</p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function FilterRail({ t, filters }: { t: Awaited<ReturnType<typeof getTranslations<"Data">>>; filters: string[][] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h4">{t("filters")}</h2>
      <p className="text-small text-neutral-700">{t("filtersPending")}</p>
      {filters.map(([label, value]) => (
        <label key={label} className="block">
          <span className="label mb-1.5 block text-neutral-700">{label}</span>
          <select disabled aria-disabled className="h-10 w-full cursor-not-allowed border border-neutral-500 bg-neutral-100 px-3 text-ui opacity-70">
            <option>{value}</option>
          </select>
        </label>
      ))}
      <label className="flex cursor-not-allowed items-center gap-2.5 text-ui opacity-70">
        <input type="checkbox" disabled defaultChecked className="size-5 accent-ink" />
        {t("hazards")}
      </label>
      <div className="border-t-2 border-ink pt-4">
        <h3 className="label mb-2 text-neutral-700">{t("downloads")}</h3>
        <ul>
          {DASHBOARD.downloads.map(([file, size]) => (
            <li key={file} className="flex justify-between border-b border-neutral-400 py-2 text-small text-neutral-700">
              <span className="font-mono font-semibold">{file}</span>
              <span>{size}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-meta text-neutral-700">{t("downloadsPending")}</p>
        <p className="mt-1 text-meta text-neutral-700">{t("downloadsNote")}</p>
      </div>
    </div>
  );
}
