import { getLocale, getTranslations } from "next-intl/server";
import { ChartData, Columns, HBars, LineChart, Pyramid, type Bar } from "@/components/charts/charts";
import { Choropleth } from "@/components/charts/choropleth";
import { Labels, Panel } from "@/components/data/layout";
import { bsLong, bsMonthName, digits, fmtNum, type Locale } from "@/lib/format";
import { RECORDING_SINCE } from "@/lib/sample/data";
import {
  getAgeSex, getCauses, getCrashSizes, getCrashTypes, getDistricts, getHighways, getKpis, getMonthly,
  getPoliceCoverage, getProvinces, getRoadUsers, getTimeOfDay, getVehicles, getWeekdays,
} from "@/lib/stats/dashboard";

/**
 * The research dashboard's modules (SPEC 9.2). Each one loads its own numbers from lib/stats and
 * renders one panel, so each can sit in its own <Suspense> (components/data/layout.tsx `Slot`).
 * A module never needs another module's data, and the cached loaders make shared data (districts)
 * a single lookup.
 */

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

async function setup() {
  const [t, common, locale] = await Promise.all([getTranslations("Data"), getTranslations("Common"), getLocale() as Promise<Locale>]);
  return { t, common, locale, n: (v: number) => fmtNum(v, locale) };
}

export async function KpiStrip() {
  const [{ t, common, locale, n }, k] = await Promise.all([setup(), getKpis()]);
  const kpis = [
    { label: common("killed"), value: n(k.killed), sub: t("kpiKilledSub", { date: bsLong(RECORDING_SINCE, locale) }), red: true },
    { label: common("crashes"), value: n(k.crashes), sub: t("kpiCrashesSub", { count: n(k.fatalCrashes) }), red: false },
    { label: common("injured"), value: n(k.injured), sub: t("kpiInjuredSub", { count: n(k.serious) }), red: false },
    { label: t("kpiHazard"), value: n(k.hazard), sub: t("kpiHazardSub"), red: false },
    { label: t("kpiCoverage"), value: `${n(k.coverage)}%`, sub: t("kpiCoverageSub"), red: false },
  ];
  return (
    <dl className="grid grid-cols-2 border-b-2 border-ink sm:grid-cols-3 xl:grid-cols-5">
      {kpis.map((s) => (
        <div key={s.label} className="border-b border-r border-neutral-400 px-4 py-4 lg:px-6 lg:py-5 xl:border-b-0">
          <dt className="label text-neutral-700">{s.label}</dt>
          <dd className={`text-[26px] font-extrabold leading-tight tabular lg:text-[32px] ${s.red ? "text-accent-600" : ""}`}>{s.value}</dd>
          <dd className="text-meta text-neutral-700">{s.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function MonthTrend() {
  const [{ t, common, locale, n }, m] = await Promise.all([setup(), getMonthly()]);
  const months = m.killed.map((_, i) => bsMonthName(i + 1, locale));
  return (
    <Panel title={t("byMonth")}>
      <LineChart
        xLabels={months}
        series={[
          { key: "killed", label: t("legendKilled"), values: m.killed, stroke: "stroke-accent", width: 3 },
          { key: "crashes", label: t("legendCrashes"), values: m.crashes, stroke: "stroke-ink", width: 2 },
        ]}
        reference={{ value: m.policeAvg, label: t("legendPolice") }}
        stepTitles={months.map((mo, i) => t("monthTitle", { month: mo, killed: n(m.killed[i]), crashes: n(m.crashes[i]) }))}
        height={220}
        format={n}
      />
      <ChartData summary={common("table")} csvName="killed-and-crashes-by-month.csv" columns={[t("colMonth"), t("colKilled"), t("colCrashes")]} rows={months.map((mo, i) => [mo, m.killed[i], m.crashes[i]])} />
    </Panel>
  );
}

export async function ProvinceBars() {
  const [{ t, common, n }, pt, provinces] = await Promise.all([setup(), getTranslations("Province"), getProvinces()]);
  return (
    <Panel title={t("byProvince")}>
      <HBars fill="bg-accent" labelWidth={110} valueLabel={t("byProvince")} rows={provinces.map(([p, v]) => ({ key: p, label: pt(p as never), value: v, display: n(v) }))} />
      <ChartData summary={common("table")} csvName="killed-by-province.csv" columns={[t("colProvince"), t("colKilled")]} rows={provinces.map(([p, v]) => [pt(p as never), v])} />
    </Panel>
  );
}

export async function DistrictMap() {
  const [{ t, common, locale, n }, districts] = await Promise.all([setup(), getDistricts()]);
  const values = Object.fromEntries(districts.map((d) => [d.slug, d.killed]));
  return (
    <Panel title={t("byDistrict")} body={t("byDistrictBody")}>
      <Choropleth values={values} locale={locale} label={t("byDistrict")} legendTitle={t("mapLegend")} format={n} />
      <ChartData
        summary={common("table")}
        csvName="killed-by-district.csv"
        columns={[t("colDistrict"), t("colKilled")]}
        rows={districts.map((d) => [locale === "ne" ? d.np : d.en, d.killed])}
      />
    </Panel>
  );
}

export async function TopDistricts() {
  const [{ t, locale, n }, districts] = await Promise.all([setup(), getDistricts()]);
  return (
    <Panel title={t("topDistricts")}>
      <HBars fill="bg-accent" labelWidth={120} valueLabel={t("topDistricts")} rows={districts.slice(0, 12).map((d) => ({ key: d.slug, label: locale === "ne" ? d.np : d.en, value: d.killed, display: n(d.killed) }))} />
    </Panel>
  );
}

export async function VehicleBars() {
  const [{ t, common, n }, vt, vehicles] = await Promise.all([setup(), getTranslations("Vehicle"), getVehicles()]);
  return (
    <Panel title={t("byVehicle")}>
      <HBars valueLabel={t("byVehicle")} rows={vehicles.map(([v, c]) => ({ key: v, label: vt(v), value: c, display: n(c) }))} />
      <ChartData summary={common("table")} csvName="killed-by-vehicle.csv" columns={[t("vehicle"), t("colKilled")]} rows={vehicles.map(([v, c]) => [vt(v), c])} />
    </Panel>
  );
}

export async function CrashTypeBars() {
  const [{ t, common, n }, ct, types] = await Promise.all([setup(), getTranslations("CrashType"), getCrashTypes()]);
  return (
    <Panel title={t("byCrashType")}>
      <HBars labelWidth={120} valueLabel={t("byCrashType")} rows={types.map(([v, c]) => ({ key: v, label: ct(v as never), value: c, display: n(c) }))} />
      <ChartData summary={common("table")} csvName="killed-by-crash-type.csv" columns={[t("crashType"), t("colKilled")]} rows={types.map(([v, c]) => [ct(v as never), c])} />
    </Panel>
  );
}

export async function RoadUserBars() {
  const [{ t, common, n }, rt, users] = await Promise.all([setup(), getTranslations("RoadUser"), getRoadUsers()]);
  return (
    <Panel title={t("byRoadUser")}>
      <HBars labelWidth={110} valueLabel={t("byRoadUser")} rows={users.map(([v, c]) => ({ key: v, label: rt(v as never), value: c, display: n(c) }))} />
      <ChartData summary={common("table")} csvName="killed-by-road-user.csv" columns={[t("colGroup"), t("colKilled")]} rows={users.map(([v, c]) => [rt(v as never), c])} />
    </Panel>
  );
}

function columnBars(rows: [string, number][], label: (key: string) => string, killed: (n: number) => string): Bar[] {
  return rows.map(([key, v]) => ({ key, value: v, title: `${label(key)}: ${killed(v)}` }));
}

export async function TimeOfDay() {
  const [{ t, common, locale, n }, byTime] = await Promise.all([setup(), getTimeOfDay()]);
  return (
    <Panel title={t("timeOfDay")}>
      <Columns bars={columnBars(byTime, (key) => digits(key, locale), (v) => common("killedCount", { count: n(v) }))} height={110} fill="fill-ink" gap={0.25} label={t("timeOfDay")} />
      <Labels items={byTime.map(([l]) => digits(l, locale))} />
      <ChartData summary={common("table")} csvName="killed-by-time-of-day.csv" columns={[t("colGroup"), t("colKilled")]} rows={byTime.map(([l, v]) => [l, v])} />
    </Panel>
  );
}

export async function Weekdays() {
  const [{ t, common, n }, byWeekday] = await Promise.all([setup(), getWeekdays()]);
  const bars: [string, number][] = WEEKDAY_KEYS.map((d, i) => [d, byWeekday[i]]);
  return (
    <Panel title={t("byWeekday")}>
      <Columns bars={columnBars(bars, (key) => t(`weekdays.${key}` as never), (v) => common("killedCount", { count: n(v) }))} height={110} fill="fill-ink" gap={0.25} label={t("byWeekday")} />
      <Labels items={WEEKDAY_KEYS.map((d) => t(`weekdays.${d}` as never))} />
      <ChartData summary={common("table")} csvName="killed-by-day-of-week.csv" columns={[t("colGroup"), t("colKilled")]} rows={bars.map(([d, v]) => [t(`weekdays.${d}` as never), v])} />
    </Panel>
  );
}

export async function AgeSex() {
  const [{ t, common, locale, n }, ages] = await Promise.all([setup(), getAgeSex()]);
  const total = ages.reduce((s, [, a, b]) => s + a + b, 0);
  return (
    <Panel title={t("ageSex")} body={t("ageSexNote", { count: n(total) })}>
      <Pyramid rows={ages.map(([band, a, b]) => [digits(band, locale), a, b])} left={t("male")} right={t("female")} format={n} />
      <ChartData summary={common("table")} csvName="killed-by-age-and-sex.csv" columns={[t("colGroup"), t("colMale"), t("colFemale")]} rows={ages.map(([band, a, b]) => [band, a, b])} />
    </Panel>
  );
}

export async function Causes() {
  const [{ t, common, n }, causes] = await Promise.all([setup(), getCauses()]);
  return (
    <Panel title={t("causes")} body={t("causesBody")}>
      <HBars labelWidth={130} valueLabel={t("causes")} rows={causes.map(([c, v]) => ({ key: c, label: t(`cause.${c}` as never), value: v, display: n(v) }))} />
      <ChartData summary={common("table")} csvName="crashes-by-stated-cause.csv" columns={[t("colGroup"), t("colCrashes")]} rows={causes.map(([c, v]) => [t(`cause.${c}` as never), v])} />
    </Panel>
  );
}

export async function CrashSizes() {
  const [{ t, common, locale, n }, sizes] = await Promise.all([setup(), getCrashSizes()]);
  return (
    <Panel title={t("crashSize")} body={t("crashSizeBody")}>
      <Columns
        bars={sizes.map(([s, v]) => ({ key: s, value: v, title: `${t("crashSizeLabel", { n: digits(s, locale) })}: ${t("crashesN", { count: n(v) })}` }))}
        height={130}
        fill="fill-ink"
        gap={0.3}
        label={t("crashSize")}
      />
      <Labels items={sizes.map(([s]) => t("crashSizeLabel", { n: digits(s, locale) }))} />
      <ChartData summary={common("table")} csvName="fatal-crashes-by-deaths.csv" columns={[t("colGroup"), t("colCrashes")]} rows={sizes.map(([s, v]) => [s, v])} />
    </Panel>
  );
}

export async function DeadliestHighways() {
  const [{ t, common, locale }, highways] = await Promise.all([setup(), getHighways()]);
  return (
    <Panel title={t("highways")} body={t("highwaysBody")}>
      <HBars
        fill="bg-accent"
        labelWidth={70}
        valueLabel={t("highways")}
        rows={[...highways]
          .map(([ref, km, killed]) => ({ ref, km, killed, per: (killed / km) * 100 }))
          .sort((a, b) => b.per - a.per)
          .map((h) => ({
            key: h.ref,
            label: h.ref,
            value: h.per,
            display: digits(h.per.toFixed(1), locale),
            href: h.ref === "NH17" ? `/${locale}/highway/NH17` : undefined,
          }))}
      />
      <ChartData
        summary={common("table")}
        csvName="killed-per-100-km-by-highway.csv"
        columns={[t("colHighway"), t("colLength"), t("colKilled"), t("colPer100")]}
        rows={highways.map(([ref, km, killed]) => [ref, km, killed, ((killed / km) * 100).toFixed(1)])}
      />
    </Panel>
  );
}

export async function PoliceComparison() {
  const [{ t, common, n }, pt, coverage] = await Promise.all([setup(), getTranslations("Province"), getPoliceCoverage()]);
  return (
    <Panel title={t("vsPolice")} body={t("vsPoliceBody")}>
      <ul>
        {coverage.map(([p, cov]) => (
          <li key={p} className="py-1.5" title={`${pt(p as never)}: ${n(cov)}%`}>
            <p className="flex justify-between text-ui"><b>{pt(p as never)}</b><span className="tabular">{n(cov)}%</span></p>
            <span aria-hidden className="mt-1 block h-2 bg-neutral-300"><span className="block h-2 bg-accent" style={{ width: `${cov}%` }} /></span>
          </li>
        ))}
      </ul>
      <ChartData summary={common("table")} csvName="coverage-vs-police.csv" columns={[t("colProvince"), t("colCoverage")]} rows={coverage.map(([p, c]) => [pt(p as never), c])} />
    </Panel>
  );
}
