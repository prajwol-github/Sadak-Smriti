import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ChartData, Columns, HBars, type Bar } from "@/components/charts/charts";
import { StaticMap } from "@/components/map/static-map";
import { LiveMap } from "@/components/map/live-map";
import { liveMapText } from "@/lib/map/live-text";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { Link } from "@/lib/i18n/navigation";
import { pxPerUnitForSpan } from "@/lib/map/preview-projection";
import { bsMonthName, bsShort, digits, fmtNum, type Locale } from "@/lib/format";
import { ALL_CRASHES, HIGHWAY_DETAIL, HIGHWAY_RISK } from "@/lib/sample/data";

type Params = PageProps<"/[locale]/highway/[ref]">["params"];
type H = typeof HIGHWAY_DETAIL;

/** Only one highway has sample data; real highways come from the database (PLAN P0-11, P4-03). */
const HIGHWAYS: Record<string, H> = { [HIGHWAY_DETAIL.ref]: HIGHWAY_DETAIL };

export function generateStaticParams() {
  return Object.keys(HIGHWAYS).map((ref) => ({ ref }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/highway/[ref]">): Promise<Metadata> {
  const h = HIGHWAYS[(await params).ref.toUpperCase()];
  if (!h) return {};
  const t = await getTranslations("Highway");
  const locale = (await getLocale()) as Locale;
  return { title: t("metaTitle", { name: h.name[locale], ref: h.ref }) };
}

/** Highway page (design handoff screen 5, SPEC 6.6). Sample data until PLAN P4-03. */
export default function HighwayPage({ params }: PageProps<"/[locale]/highway/[ref]">) {
  return (
    <>
      <SiteNav current="map" />
      <main id="content">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Highway params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** "112–113" → [112, 113] */
const kmRange = (s: string) => s.split(/[–-]/).map(Number) as [number, number];

async function Highway({ params }: { params: Params }) {
  const h = HIGHWAYS[(await params).ref.toUpperCase()];
  if (!h) notFound();
  const t = await getTranslations("Highway");
  const common = await getTranslations("Common");
  const vt = await getTranslations("Vehicle");
  const mapT = await getTranslations("Map");
  const locale = (await getLocale()) as Locale;
  const n = (v: number) => fmtNum(v, locale);

  const blackspotKm = new Set(h.blackspots.map((b) => kmRange(b.km)[0]));
  const perKm: Bar[] = h.segments.map((v, km) => ({
    key: String(km),
    value: v,
    highlight: blackspotKm.has(km),
    title: t("segmentTitle", { from: n(km), to: n(km + 1), killed: digits(String(v), locale) }),
  }));
  const timeBars: Bar[] = h.byTime.map(([label, v]) => ({ key: label, value: v, title: `${digits(label, locale)}: ${n(v)}` }));
  const monthBars: Bar[] = h.byMonth.map(([m, v]) => ({ key: String(m), value: v, title: `${bsMonthName(m, locale)}: ${n(v)}` }));
  const recent = ALL_CRASHES.filter((c) => c.highwayRef === h.ref).sort((a, b) => b.date.localeCompare(a.date));

  const stats = [
    { label: common("crashes"), value: n(h.stats.crashes), red: false },
    { label: common("killed"), value: n(h.stats.killed), red: true },
    { label: common("injured"), value: n(h.stats.injured), red: false },
    { label: t("statBlackspots"), value: `${n(h.stats.blackspotKm)} ${locale === "ne" ? "किमी" : "km"}`, red: false },
  ];

  return (
    <article>
      {/* Header: name, totals, cropped map */}
      <header className="border-b-2 border-ink lg:grid lg:grid-cols-2">
        <div className="px-4 py-6 lg:border-r-2 lg:border-ink lg:px-8 lg:py-9">
          <span className="tag border border-ink font-semibold">{t("tag", { ref: h.ref })}</span>
          <h1 className="mt-4 text-[36px] lg:text-[56px]">{h.name[locale]}</h1>
          <p className="text-[18px] text-neutral-700 lg:text-[24px]">{h.name[locale === "ne" ? "en" : "ne"]}</p>
          <p className="mt-3 text-body">{t("lengthLine", { from: h.from[locale], km: n(h.lengthKm) })}</p>
          <dl className="mt-6 grid grid-cols-2 border-t-2 border-ink sm:grid-cols-4 lg:mt-7">
            {stats.map((s) => (
              <div key={s.label} className="py-3.5">
                <dt className="label text-neutral-700">{s.label}</dt>
                <dd className={`text-[28px] font-extrabold leading-tight tabular lg:text-[34px] ${s.red ? "text-accent-600" : ""}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative h-[240px] overflow-hidden border-t-2 border-ink bg-neutral-200 lg:h-auto lg:min-h-[340px] lg:border-t-0">
          <LiveMap
            tone="light"
            locale={locale}
            risk={HIGHWAY_RISK}
            selected={h.ref}
            dots={recent.map((c) => ({ key: c.slug, lon: c.lon, lat: c.lat, killed: c.killed, precise: c.precise, label: c.title[locale] }))}
            dotPath="/crash"
            view={{ kind: "highway", ref: h.ref, padding: 40 }}
            cooperativeGestures
            rail="compact"
            railClassName="absolute right-4 top-4"
            text={liveMapText(mapT)}
          >
            <StaticMap
              tone="light"
              risk={HIGHWAY_RISK}
              selected={h.ref}
              view={{ ...h.view, aspect: 720 / 380 }}
              labels={false}
              graticule={false}
              pxPerUnit={pxPerUnitForSpan(h.view.spanLon, 720)}
              locale={locale}
              title={h.name[locale]}
            />
          </LiveMap>
          <Link href="/map" className="absolute left-4 top-4 z-20 bg-bg px-2.5 py-1.5 text-meta font-semibold no-underline">{t("openOnMap")}</Link>
        </div>
      </header>

      {/* Killed per km */}
      <section aria-labelledby="perkm-h" className="border-b-2 border-ink px-4 py-8 lg:px-8 lg:py-9">
        <h2 id="perkm-h" className="text-[22px] lg:text-h2">
          <span className="lg:hidden">{t("perKmShort")}</span>
          <span className="hidden lg:inline">{t("perKm")}</span>
        </h2>
        <p className="mt-1 text-ui text-neutral-700">{t("perKmBody")}</p>
        <p className="mt-1 text-small text-neutral-700">{t("chartNote")}</p>
        {/* On phones the 174 bars keep a readable width and scroll inside their own box. */}
        <div className="mt-6 overflow-x-auto pb-1">
          <div className="min-w-[720px]">
            <Columns bars={perKm} height={140} fill="fill-neutral-600" highlightFill="fill-accent" gap={0.15} label={t("perKm")} />
            <div aria-hidden className="relative mt-1.5 h-4 text-meta text-neutral-700">
              {h.landmarks.map((l, i) => (
                <span
                  key={l.km}
                  className="absolute whitespace-nowrap"
                  style={i === h.landmarks.length - 1 ? { right: 0 } : { left: `${(l.km / h.lengthKm) * 100}%`, transform: i === 0 ? undefined : "translateX(-50%)" }}
                >
                  {i === 0 || i === h.landmarks.length - 1 ? `${common("km", { km: n(l.km) })} ` : ""}{l.name[locale]}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-small">
          <span className="flex items-center gap-2"><span aria-hidden className="inline-block size-3 bg-accent" />{t("blackspotLegend")}</span>
          <span className="flex items-center gap-2"><span aria-hidden className="inline-block size-3 bg-neutral-600" />{t("otherLegend")}</span>
        </p>
        <ChartData
          summary={common("table")}
          csvName={`${h.ref.toLowerCase()}-killed-per-km.csv`}
          columns={[t("colKm"), t("colKilled")]}
          rows={h.segments.map((v, km) => [`${km}–${km + 1}`, v])}
        />
      </section>

      {/* Blackspots | vehicles and time of day */}
      <div className="border-b-2 border-ink lg:grid lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="bs-h" className="border-b-2 border-ink px-4 py-8 lg:border-b-0 lg:border-r-2 lg:px-8 lg:py-9">
          <h2 id="bs-h" className="mb-3 text-[22px] lg:text-h2">{t("blackspots")}</h2>
          <table className="w-full text-ui">
            <thead>
              <tr className="label border-b-2 border-ink text-left text-neutral-700">
                <th scope="col" className="w-10 py-2">#</th>
                <th scope="col" className="py-2">{t("colSegment")}</th>
                <th scope="col" className="py-2">{t("colKm")}</th>
                <th scope="col" className="py-2 text-right">{common("crashes")}</th>
                <th scope="col" className="py-2 text-right">{common("killed")}</th>
              </tr>
            </thead>
            <tbody>
              {h.blackspots.map((b, i) => (
                <tr key={b.km} className="border-b border-neutral-400">
                  <td className="py-2.5 font-extrabold text-neutral-500 tabular">{n(i + 1)}</td>
                  <th scope="row" className="py-2.5 text-left font-extrabold">{b.place[locale]}</th>
                  <td className="py-2.5 tabular">{digits(b.km, locale)}</td>
                  <td className="py-2.5 text-right tabular">{n(b.crashes)}</td>
                  <td className="py-2.5 text-right font-extrabold text-accent-700 tabular">{n(b.killed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="px-4 py-8 lg:px-8 lg:py-9">
          <section aria-labelledby="veh-h">
            <h3 id="veh-h" className="mb-3 text-h4">{t("byVehicle")}</h3>
            <HBars valueLabel={t("byVehicle")} rows={h.byVehicle.map(([v, k]) => ({ key: v, label: vt(v), value: k, display: n(k) }))} />
          </section>
          <section aria-labelledby="time-h" className="mt-8">
            <h3 id="time-h" className="mb-3 text-h4">{t("byTime")}</h3>
            <Columns bars={timeBars} height={90} fill="fill-ink" gap={0.25} label={t("byTime")} />
            <div aria-hidden className="mt-1 flex text-[10px] text-neutral-700">
              {h.byTime.map(([l]) => <span key={l} className="flex-1 text-center">{digits(l, locale)}</span>)}
            </div>
            <ChartData summary={common("table")} csvName={`${h.ref.toLowerCase()}-killed-by-time.csv`} columns={[t("hours"), t("colKilled")]} rows={h.byTime.map(([l, v]) => [l, v])} />
          </section>
        </div>
      </div>

      {/* Months | recent crashes */}
      <div className="lg:grid lg:grid-cols-[1fr_1.3fr]">
        <section aria-labelledby="month-h" className="border-b-2 border-ink px-4 py-8 lg:border-b-0 lg:border-r-2 lg:px-8 lg:py-9">
          <h3 id="month-h" className="mb-3 text-h4">{t("byMonth", { year: n(h.monthsYear).replace(/,/g, "") })}</h3>
          <Columns bars={monthBars} height={120} fill="fill-accent" gap={0.2} label={t("byMonth", { year: String(h.monthsYear) })} />
          <div aria-hidden className="mt-1 flex text-meta text-neutral-700">
            {h.byMonth.map(([m]) => <span key={m} className="flex-1 truncate text-center">{bsMonthName(m, locale)}</span>)}
          </div>
          <ChartData summary={common("table")} csvName={`${h.ref.toLowerCase()}-killed-by-month.csv`} columns={[t("colDate"), t("colKilled")]} rows={h.byMonth.map(([m, v]) => [bsMonthName(m, locale), v])} />
        </section>

        <section aria-labelledby="recent-h" className="px-4 py-8 lg:px-8 lg:py-9">
          <h3 id="recent-h" className="mb-2 text-h4">{t("recent", { ref: h.ref })}</h3>
          {recent.length === 0 ? (
            <p className="text-ui text-neutral-700">{t("noRecent")}</p>
          ) : (
            <ul>
              {recent.map((c) => (
                <li key={c.slug} className="border-t border-neutral-400">
                  <Link href={`/crash/${c.slug}`} className="grid grid-cols-[90px_1fr_auto] items-baseline gap-3 py-2.5 text-ui no-underline hover:underline sm:grid-cols-[100px_1fr_100px_80px]">
                    <span className="text-neutral-700">{bsShort(c.date, locale)}</span>
                    <b>{c.place[locale]}</b>
                    <span className="hidden sm:block">{c.vehicles.map((v) => vt(v)).join(", ")}</span>
                    <b className="text-right text-accent-700">{common("killedCount", { count: n(c.killed) })}</b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
