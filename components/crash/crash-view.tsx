import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { StaticMap } from "@/components/map/static-map";
import { LiveMap } from "@/components/map/live-map";
import { liveMapText } from "@/lib/map/live-text";
import { pxPerUnitForSpan } from "@/lib/map/preview-projection";
import { CRASH_DETAIL, HIGHWAY_RISK, type SampleCrash } from "@/lib/sample/data";
import { adShort, bsLong, bsShort, digits, fmtNum, type Locale } from "@/lib/format";

type Detail = typeof CRASH_DETAIL;
type Person = Detail["killedPeople"][number];

/**
 * Crash page (design handoff screen 3, SPEC 6.4). Sample data until PLAN P1-08.
 *
 * Only the latest sample crash has people, claims and sources (`detail`). Every other sample
 * crash shows its header, counts, map and place, and says the rest is not in the sample data.
 *
 * Privacy (SPEC 7.5, 8): a hidden name renders as a "withheld" tile and its text never reaches
 * the HTML; a person not yet named renders as a dashed tile. Neither carries a link.
 */
export async function CrashView({ crash, detail }: { crash: SampleCrash; detail: Detail | null }) {
  const t = await getTranslations("Crash");
  const common = await getTranslations("Common");
  const vehicleT = await getTranslations("Vehicle");
  const typeT = await getTranslations("CrashType");
  const kindT = await getTranslations("Kind");
  const locale = (await getLocale()) as Locale;

  const vehicles = crash.vehicles.map((v) => vehicleT(v)).join(" + ");
  const crashType = detail ? typeT(detail.crashType) : null;
  const when = `${bsLong(crash.date, locale)} BS · ${adShort(crash.date, locale)} AD`;
  const time = crash.time ? digits(crash.time, locale) : null;
  const named = detail ? detail.killedPeople.filter((p) => p.name).length : 0;
  const mapT = await getTranslations("Map");
  const mapView = { lon: crash.lon, lat: crash.lat, spanLon: 1, aspect: 420 / 260 };

  const placeLines = detail
    ? detail.placeLines[locale]
    : [crash.place[locale], `${crash.district[locale]}`, crash.highwayRef ? `${crash.highwayRef}${crash.km != null ? ` · ${common("km", { km: digits(String(crash.km), locale) })}` : ""}` : common("notHighway")];
  const vehicleLines = detail ? detail.vehicleLines[locale] : [vehicles];

  const counts = [
    { label: common("killed"), value: fmtNum(crash.killed, locale), red: true, sub: null },
    {
      label: common("injured"),
      value: fmtNum(crash.injured, locale),
      red: false,
      sub: detail ? t("injuredBreakdown", { serious: fmtNum(detail.injuredSerious, locale), minor: fmtNum(detail.injuredMinor, locale) }) : null,
    },
    { label: common("onBoard"), value: crash.onBoard != null ? fmtNum(crash.onBoard, locale) : "–", red: false, sub: crash.onBoard == null ? t("onBoardUnknown") : null },
  ];

  const verified = detail ? t("verified", { count: fmtNum(detail.verification.outlets, locale) }) : null;
  const verifiedShort = detail ? t("verifiedShort", { count: fmtNum(detail.verification.outlets, locale) }) : null;

  const map = (height: string, widthPx: number, caption: React.ReactNode) => (
    <div className={`relative overflow-hidden border-b-2 border-ink bg-neutral-200 ${height}`}>
      <LiveMap
        tone="light"
        locale={locale}
        dots={[{ key: crash.slug, lon: crash.lon, lat: crash.lat, killed: crash.killed, precise: crash.precise, label: crash.title[locale] }]}
        risk={HIGHWAY_RISK}
        selected={crash.highwayRef ?? undefined}
        view={{ kind: "point", lon: crash.lon, lat: crash.lat, zoom: crash.precise ? 10.5 : 8.5 }}
        highwayLinks={Object.keys(HIGHWAY_RISK)}
        cooperativeGestures
        rail="compact"
        railClassName="absolute right-3 top-3"
        text={liveMapText(mapT)}
      >
        <StaticMap
          tone="light"
          dots={[{ key: crash.slug, lon: crash.lon, lat: crash.lat, killed: crash.killed, precise: crash.precise }]}
          risk={HIGHWAY_RISK}
          selected={crash.highwayRef ?? undefined}
          view={mapView}
          labels={false}
          graticule={false}
          pxPerUnit={pxPerUnitForSpan(mapView.spanLon, widthPx)}
          locale={locale}
          title={t("openOnMap")}
        />
      </LiveMap>
      <span className="absolute bottom-3 left-4 bg-bg px-2 py-1 text-meta font-semibold">{caption}</span>
    </div>
  );

  const accuracy = detail ? detail.placeAccuracy[locale] : null;

  return (
    <article>
      {/* Header: title block and the three counts */}
      <header className="border-b-2 border-ink lg:grid lg:grid-cols-[1fr_420px]">
        <div className="px-4 py-5 lg:border-r-2 lg:border-ink lg:px-8 lg:pb-7 lg:pt-8">
          {detail && (
            <nav aria-label={t("breadcrumbLabel")} className="hidden text-small text-neutral-700 lg:block">
              {detail.breadcrumb[locale].join(" / ")}
            </nav>
          )}
          <p className="text-meta text-neutral-700 lg:hidden">
            {bsLong(crash.date, locale)} · {adShort(crash.date, locale)}
            {time && ` · ${time}`}
          </p>
          <h1 className="mt-2 text-[28px] lg:mt-3.5 lg:max-w-[820px] lg:text-[44px]">{crash.title[locale]}</h1>
          <p className="mt-3 hidden flex-wrap gap-x-7 gap-y-1 text-body lg:flex">
            <span>{when}</span>
            {time && (
              <span>
                <b>{time}</b>
                {detail && <span className="text-neutral-700"> {t("timeDisputed", { times: digits(detail.timeDisputed, locale) })}</span>}
              </span>
            )}
            <span>{[crashType, vehicles].filter(Boolean).join(" · ")}</span>
          </p>
          {detail && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 lg:mt-[18px]">
              <span className="tag bg-surface font-semibold">
                <span className="lg:hidden">{verifiedShort}</span>
                <span className="hidden lg:inline">{verified}</span>
              </span>
              <span className="hidden text-small text-neutral-700 lg:inline">
                {t("updated", { sources: fmtNum(crash.sources, locale), date: `${bsShort(detail.updated.slice(0, 10), locale)}, ${digits(detail.updated.slice(11), locale)}` })}
              </span>
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 border-t-2 border-ink lg:border-t-0">
          {counts.map((c) => (
            <div key={c.label} className="border-r border-neutral-400 px-4 py-3 last:border-r-0 lg:px-5 lg:py-8 lg:first:px-6">
              <dt className="label text-neutral-700">{c.label}</dt>
              <dd className={`mt-1 text-[36px] font-extrabold leading-none tabular lg:mt-2 lg:text-[72px] ${c.red ? "text-accent-600" : ""}`}>{c.value}</dd>
              {c.sub && <dd className="mt-1.5 hidden text-balance text-meta text-neutral-700 lg:block">{c.sub}</dd>}
            </div>
          ))}
        </dl>
      </header>

      {/* Phone: map strip, place, toll bar */}
      <div className="lg:hidden">
        {map("h-[200px]", 375, <>{accuracy ?? t("place")} · <Link href="/map" className="font-semibold">{t("openOnMap")}</Link></>)}
        <p className="border-b border-neutral-400 px-4 py-4 text-ui leading-normal">
          <b>{crash.place[locale]}</b>, {crash.district[locale]}
          <br />
          <span className="text-neutral-700">{[accuracy, vehicleLines.join(", ")].filter(Boolean).join(" · ")}</span>
        </p>
        {detail && (
          <p className="bg-surface px-4 py-4 text-ui">
            <b>{t("tollMobile", { values: detail.tolls.map((x) => fmtNum(x.value, locale)).join(", "), final: fmtNum(detail.tolls.find((x) => x.final)?.value ?? crash.killed, locale) })}</b>
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_420px]">
        <div className="lg:border-r-2 lg:border-ink">
          {detail ? (
            <>
              <PeopleSection detail={detail} locale={locale} named={named} killed={crash.killed} t={t} />
              <DisagreeSection detail={detail} locale={locale} t={t} />
              <SourcesSection detail={detail} crash={crash} locale={locale} t={t} kind={(k) => kindT(k as "report" | "followUp" | "roundup" | "other")} />
            </>
          ) : (
            <p className="px-4 py-8 text-body text-neutral-700 lg:px-8">{t("detailsPending")}</p>
          )}
        </div>

        {/* Desktop right column */}
        <aside className="hidden lg:block" aria-label={t("place")}>
          {map("h-[260px]", 420, accuracy ?? t("place"))}
          <Facts label={t("place")} lines={placeLines} />
          <Facts label={t("vehicle")} lines={vehicleLines} />
          {detail && (
            <div className="border-b-2 border-ink p-6">
              <h2 className="label mb-2 text-neutral-700">{t("causes")}</h2>
              <p className="text-body leading-normal">{detail.cause.text[locale]}</p>
              <p className="mt-1.5 text-small text-neutral-700">{detail.cause.by[locale]}</p>
            </div>
          )}
          <Actions t={t} />
        </aside>
      </div>

      {/* Phone: actions */}
      <div className="grid grid-cols-2 gap-2 border-t-2 border-ink p-4 lg:hidden">
        <Disabled>{t("suggest")}</Disabled>
        <Disabled>{t("addPerson")}</Disabled>
      </div>
    </article>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"Crash">>>;

/** A control for a feature that is built later (PLAN P1-12): shown, not wired. */
function Disabled({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" disabled aria-disabled className="btn btn-secondary w-full cursor-not-allowed opacity-60">
      {children}
    </button>
  );
}

function Facts({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="border-b border-neutral-400 p-6">
      <h2 className="label mb-2 text-neutral-700">{label}</h2>
      <p className="text-body leading-normal">
        {lines.map((l, i) => (
          <span key={i} className={`block ${i === 0 ? "font-semibold" : ""}`}>{l}</span>
        ))}
      </p>
    </div>
  );
}

function Actions({ t }: { t: T }) {
  return (
    <div className="grid gap-2 p-6">
      <Disabled>{t("suggest")}</Disabled>
      <Disabled>{t("addLink")}</Disabled>
      <Disabled>{t("addPerson")}</Disabled>
      <Disabled>{t("report")}</Disabled>
    </div>
  );
}

function PersonTile({ p, locale, t, compact }: { p: Person; locale: Locale; t: T; compact: boolean }) {
  const name = p.name?.[locale] ?? null;
  const label = name ?? (p.withheld ? t("nameWithheld") : t("notYetNamed"));
  const initial = name ? Array.from(name)[0] : "";
  const photo = (
    <span
      aria-hidden
      className={`block ${name ? "stripes" : p.withheld ? "border border-neutral-600 bg-neutral-200" : "border border-dashed border-neutral-600"} p-1.5 font-extrabold text-neutral-500 ${compact ? "h-14 text-[18px]" : "h-20 text-[22px]"}`}
    >
      {initial}
    </span>
  );
  const body = (
    <span className="block">
      <span className="block text-body font-extrabold leading-tight">{label}</span>
      {name && p.name && (
        <span className="block text-small text-neutral-700">
          {p.name[locale === "ne" ? "en" : "ne"]}
          {compact && p.age != null && p.home ? ` · ${fmtNum(p.age, locale)} · ${p.home[locale]}` : ""}
        </span>
      )}
      {!name && p.withheld && <span className="block text-small text-neutral-700">{t("nameWithheldSub")}</span>}
      {!compact && name && p.age != null && p.home && (
        <span className="mt-1 block text-meta text-neutral-700">{fmtNum(p.age, locale)} · {p.home[locale]}</span>
      )}
    </span>
  );
  const cls = `grid gap-3 border-t border-neutral-400 py-3 ${compact ? "grid-cols-[48px_1fr]" : "grid-cols-[64px_1fr]"}`;
  return p.slug && name ? (
    <Link href={`/person/${p.slug}`} aria-label={t("namedLink", { name })} className={`${cls} no-underline`}>
      {photo}
      {body}
    </Link>
  ) : (
    <div className={cls}>
      {photo}
      {body}
    </div>
  );
}

function PeopleSection({ detail, locale, named, killed, t }: { detail: Detail; locale: Locale; named: number; killed: number; t: T }) {
  const summary = t.rich("namedSummary", {
    named: fmtNum(named, locale),
    unnamed: fmtNum(detail.notYetNamed, locale),
    b: (chunks) => <b className="text-ink">{chunks}</b>,
  });
  return (
    <section aria-labelledby="killed-h" className="border-t-2 border-ink px-4 py-5 lg:border-t-0 lg:border-b-2 lg:px-8 lg:py-8">
      <div className="flex items-baseline justify-between">
        <h2 id="killed-h" className="text-[22px] lg:text-h2">{t("peopleKilled")}</h2>
        <p className="hidden text-ui text-neutral-700 lg:block">{summary}</p>
      </div>
      <p className="mb-2 text-small text-neutral-700 lg:hidden">{summary}</p>

      <ul className="hidden gap-x-4 lg:mt-5 lg:grid lg:grid-cols-4">
        {detail.killedPeople.map((p, i) => (
          <li key={i}><PersonTile p={p} locale={locale} t={t} compact={false} /></li>
        ))}
      </ul>
      <ul className="lg:hidden">
        {detail.killedPeople.slice(0, 5).map((p, i) => (
          <li key={i}><PersonTile p={p} locale={locale} t={t} compact /></li>
        ))}
      </ul>
      <p className="mt-2.5 text-ui font-semibold lg:hidden">{t("allPeople", { count: fmtNum(killed, locale) })}</p>

      <h3 className="mb-2 mt-7 hidden text-h4 lg:block">{t("injuredHeading")}</h3>
      <ul className="hidden gap-x-6 lg:grid lg:grid-cols-3">
        {detail.injuredPeople.map((p, i) => (
          <li key={i} className="border-t border-neutral-400 py-2.5 text-ui">
            <b>{p.name ? p.name[locale] : t("nameHidden")}</b> <span className="text-small text-neutral-700">· {p.meta[locale]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DisagreeSection({ detail, locale, t }: { detail: Detail; locale: Locale; t: T }) {
  return (
    <section aria-labelledby="disagree-h" className="hidden border-b-2 border-ink px-8 py-8 lg:block">
      <h2 id="disagree-h" className="text-h2">{t("disagreeHeading")}</h2>
      <p className="mb-4 mt-1 text-ui text-neutral-700">{t("disagreeBody")}</p>

      <div className="grid grid-cols-[160px_1fr_140px] items-center border-t-2 border-ink py-3.5">
        <b>{t("deathToll")}</b>
        <ol className="flex items-center">
          {detail.tolls.map((x, i) => (
            <li key={i} className="flex items-center">
              <span className={`flex flex-col gap-0.5 border-2 px-3 py-1.5 ${x.final ? "border-ink bg-ink text-bg" : "border-ink"}`}>
                <b className="text-[18px] tabular">{fmtNum(x.value, locale)}</b>
                <span className="text-[11px]">{digits(x.source, locale)}</span>
              </span>
              {i < detail.tolls.length - 1 && <span aria-hidden className="h-0.5 w-7 bg-ink" />}
            </li>
          ))}
        </ol>
        <span className="text-right text-small font-semibold">{t("claims", { count: fmtNum(detail.tolls.length, locale) })}</span>
      </div>
      <div className="grid grid-cols-[160px_1fr_140px] border-t border-neutral-400 py-3.5 text-ui">
        <b>{t("timeRow")}</b>
        <span>{digits(detail.timeDisputed, locale)}</span>
        <span />
      </div>
      <div className="grid grid-cols-[160px_1fr_140px] border-t border-neutral-400 py-3.5 text-ui">
        <b>{t("namesRow")}</b>
        <span>{t("namesSummary")}</span>
        <span />
      </div>
    </section>
  );
}

function SourcesSection({ detail, crash, locale, t, kind }: { detail: Detail; crash: SampleCrash; locale: Locale; t: T; kind: (k: string) => string }) {
  return (
    <section aria-labelledby="sources-h" className="border-t-2 border-ink px-4 py-5 lg:border-t-0 lg:px-8 lg:py-8">
      <div className="mb-2 flex items-baseline justify-between lg:mb-3">
        <h2 id="sources-h" className="text-[22px] lg:text-h2">
          <span className="lg:hidden">{t("sourcesMobile", { count: fmtNum(crash.sources, locale) })}</span>
          <span className="hidden lg:inline">{t("sourcesHeading")}</span>
        </h2>
        <span className="hidden text-ui font-semibold lg:inline">{t("showAll", { count: fmtNum(crash.sources, locale) })}</span>
      </div>

      <div role="table" aria-label={t("sourcesHeading")} className="text-ui">
        <div role="row" className="label hidden grid-cols-[150px_1fr_100px_100px] border-b-2 border-ink py-2 text-neutral-700 lg:grid">
          <span role="columnheader">{t("colOutlet")}</span>
          <span role="columnheader">{t("colHeadline")}</span>
          <span role="columnheader">{t("colDate")}</span>
          <span role="columnheader">{t("colType")}</span>
        </div>
        {detail.sources.map((s, i) => (
          <div key={i} role="row" className="border-t border-neutral-400 py-2.5 lg:grid lg:grid-cols-[150px_1fr_100px_100px] lg:items-baseline lg:border-t-0 lg:border-b lg:py-3">
            <span role="cell" className="label block text-neutral-700 lg:hidden">{s.outlet} · {kind(s.kind)}</span>
            <b role="cell" className="hidden lg:block">{s.outlet}</b>
            <span role="cell" className="block font-semibold lg:font-normal">{s.title}</span>
            <span role="cell" className="hidden text-small text-neutral-700 lg:block">{bsShort(s.date, locale)}</span>
            <span role="cell" className="hidden text-small lg:block">{kind(s.kind)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-small text-neutral-700 lg:hidden">{t("showAll", { count: fmtNum(crash.sources, locale) })}</p>
    </section>
  );
}
