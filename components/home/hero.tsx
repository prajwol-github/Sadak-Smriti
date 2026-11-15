import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { StaticMap } from "@/components/map/static-map";
import { LiveMap } from "@/components/map/live-map";
import { liveMapText } from "@/lib/map/live-text";
import { CRASHES, HIGHWAY_RISK, HOME_STATS, LATEST, RECORDING_SINCE } from "@/lib/sample/data";
import { bsLong, bsShort, fmtNum, digits, type Locale } from "@/lib/format";

/**
 * Home hero (README screen 1): the night map with the counter, the latest crash and the ruled
 * stat strip. The whole map is one link to /map (SPEC 6.2: the interactive map isn't loaded here).
 */
export async function HomeHero() {
  const t = await getTranslations("Home");
  const map = await getTranslations("Map");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;
  const s = HOME_STATS;

  const dots = CRASHES.map((c) => ({ key: c.slug, lon: c.lon, lat: c.lat, killed: c.killed, precise: c.precise }));
  const mapProps = {
    tone: "ink" as const,
    dots,
    risk: HIGHWAY_RISK,
    latest: { lon: LATEST.lon, lat: LATEST.lat },
    locale,
    title: t("mapAlt"),
  };
  const killedText = fmtNum(s.killed, locale);

  const strip = [
    { label: t("statCrashes"), value: fmtNum(s.crashes, locale), sub: t("statCrashesSub", { date: bsShort(RECORDING_SINCE, locale) }), red: false },
    { label: t("statInjured"), value: fmtNum(s.injured, locale), sub: t("statInjuredSub"), red: false },
    { label: t("statLast7"), value: t("statLast7Value", { count: fmtNum(s.last7Killed, locale) }), sub: t("statLast7Sub", { count: fmtNum(s.last7Crashes, locale) }), red: true },
    { label: t("statWorst"), value: s.worst.ref, sub: t("statWorstSub", { name: s.worst.name[locale], rate: digits(s.worst.rate.toFixed(2), locale) }), red: false },
    { label: t("statPolice", { year: digits(s.police.fiscalYear.slice(2), locale) }), value: fmtNum(s.police.killed, locale), sub: t("statPoliceSub"), red: false },
  ];

  const live = {
    tone: "ink" as const,
    locale,
    dots: dots.map((d) => ({ ...d, label: CRASHES.find((x) => x.slug === d.key)?.title[locale] })),
    risk: HIGHWAY_RISK,
    latest: { lon: LATEST.lon, lat: LATEST.lat },
    dotPath: "/crash",
    text: liveMapText(map),
  };
  const tagText = common("killedCount", { count: fmtNum(LATEST.killed, locale) }).toUpperCase();

  return (
    <section aria-labelledby="hero-count" className="bg-ink text-bg">
      {/* Desktop */}
      <div className="relative hidden h-[720px] overflow-hidden lg:block">
        <div className="absolute inset-x-0 bottom-[104px] top-0">
          <LiveMap
            {...live}
            tag={{ lon: LATEST.lon, lat: LATEST.lat, text: tagText }}
            view={{ kind: "country", padding: { top: 150, right: 220, bottom: 24, left: 96 } }}
            rail="full"
            railClassName="absolute left-6 top-[240px]"
            expandHref="/map"
          >
            <div className="absolute inset-[150px_220px_24px_96px]">
              <StaticMap {...mapProps} pxPerUnit={1.45} tag={{ lon: LATEST.lon, lat: LATEST.lat, text: tagText }} />
            </div>
          </LiveMap>
        </div>

        <div className="pointer-events-none absolute left-24 top-10 z-20 max-w-[640px]">
          <p className="label tracking-[0.12em] text-neutral-400">{t("recordedSince", { date: bsLong(RECORDING_SINCE, locale) })}</p>
          <h1 id="hero-count" className="mt-1.5 flex items-baseline gap-5">
            <span className="text-[112px] font-extrabold leading-[0.9] tracking-[-0.045em] text-accent-500 tabular">{killedText}</span>
            <span className="max-w-[240px] text-[26px] font-extrabold leading-[1.15]">{t("peopleKilled")}</span>
          </h1>
        </div>

        <Link href={`/crash/${LATEST.slug}`} className="absolute right-8 top-10 z-20 block w-[300px] border border-neutral-700 bg-ink/92 p-4 no-underline hover:text-bg hover:border-neutral-500">
          <span className="label flex justify-between text-neutral-400">
            <span>{t("latest")}</span>
            <span>{t("hoursAgo", { count: 2 })}</span>
          </span>
          <span className="mt-2 block text-body font-semibold leading-[1.35]">{LATEST.title[locale]}</span>
          <span className="mt-3 flex items-center">
            {["A", "R", "S", "B", "K", "D"].map((f) => (
              <span key={f} aria-hidden className="-mr-1.5 flex size-[30px] items-center justify-center border-2 border-ink bg-neutral-700 text-meta font-extrabold">{f}</span>
            ))}
            <span className="ml-3.5 text-meta text-neutral-400">{t("namedMore", { count: fmtNum(1, locale) })}</span>
          </span>
          <span className="mt-3 block text-small">
            <b className="text-accent-500">{common("killedCount", { count: fmtNum(LATEST.killed, locale) })}</b> · {common("injuredCount", { count: fmtNum(LATEST.injured, locale) })} · {LATEST.district[locale]}
          </span>
        </Link>

        <Link href="/map" className="absolute bottom-[132px] right-8 z-20 flex items-center gap-3 bg-bg px-4 py-3 text-ui font-extrabold text-ink no-underline hover:bg-neutral-200 hover:text-ink">
          {t("tapToExpand")} <span aria-hidden>↗</span>
        </Link>

        <dl className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-neutral-700 bg-ink/94">
          {strip.map((c) => (
            <div key={c.label} className="border-r border-neutral-800 px-6 py-[18px] last:border-r-0">
              <dt className="label text-neutral-400">{c.label}</dt>
              <dd className={`mt-1 text-[34px] font-extrabold leading-[1.1] ${c.red ? "text-accent-500" : ""}`}>{c.value}</dd>
              <dd className="text-meta text-neutral-500">{c.sub}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Phone */}
      <div className="lg:hidden">
        <div className="px-4 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t("recordedSince", { date: bsLong(RECORDING_SINCE, locale) })}</p>
          <h1 className="mt-1.5">
            <span className="block text-[76px] font-extrabold leading-[0.95] tracking-[-0.045em] text-accent-500 tabular">{killedText}</span>
            <span className="mt-1 block text-[18px] font-extrabold">{t("peopleKilled")}</span>
          </h1>
        </div>
        <div className="relative h-[250px] overflow-hidden">
          <LiveMap {...live} view={{ kind: "country", padding: { top: 16, right: 16, bottom: 20, left: 8 } }} cooperativeGestures rail="compact" railClassName="absolute left-3 top-3">
            <div className="absolute inset-[16px_16px_20px_8px]">
              <StaticMap {...mapProps} labels={false} pxPerUnit={0.48} />
            </div>
          </LiveMap>
          <Link href="/map" className="absolute bottom-4 right-4 z-20 bg-bg px-3.5 py-2.5 text-small font-extrabold text-ink no-underline">{t("expandMap")} ↗</Link>
        </div>
        <dl className="flex overflow-x-auto border-t border-neutral-700">
          {strip.map((c) => (
            <div key={c.label} className="w-[150px] flex-none border-r border-neutral-800 px-4 py-3.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{c.label}</dt>
              <dd className={`text-[26px] font-extrabold leading-[1.15] ${c.red ? "text-accent-500" : ""}`}>{c.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** The "Latest" block on phones (README Home mobile). */
export async function LatestMobile() {
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;
  return (
    <Link href={`/crash/${LATEST.slug}`} className="block border-b-2 border-ink px-4 py-5 no-underline lg:hidden">
      <span className="label flex justify-between text-neutral-700">
        <span>{t("latest")}</span>
        <span>{bsShort(LATEST.date, locale)} · {digits(LATEST.time ?? "", locale)}</span>
      </span>
      <span className="mt-1.5 block text-[17px] font-extrabold leading-[1.3]">{LATEST.title[locale]}</span>
      <span className="mt-1.5 block text-small">
        <b className="text-accent-700">{common("killedCount", { count: fmtNum(LATEST.killed, locale) })}</b> · {common("injuredCount", { count: fmtNum(LATEST.injured, locale) })} · {common("sourcesCount", { count: fmtNum(LATEST.sources, locale) })}
      </span>
    </Link>
  );
}
