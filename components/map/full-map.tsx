import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { CityLayer, StaticMap } from "@/components/map/static-map";
import { LiveMap } from "@/components/map/live-map";
import { liveMapText } from "@/lib/map/live-text";
import { CRASH_DETAIL, CRASHES, HIGHWAY_DETAIL, HIGHWAY_RISK, LATEST, WEEKLY_KILLED } from "@/lib/sample/data";
import { bsMonthName, bsShort, digits, fmtNum, type Locale } from "@/lib/format";

const BARS_MAX = Math.max(...WEEKLY_KILLED);

/** A control that needs the interactive map. Shown, but disabled, until P1-09 ships it. */
function Disabled({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" disabled aria-disabled className={`cursor-not-allowed disabled:opacity-60 ${className}`}>
      {children}
    </button>
  );
}

/**
 * Full map (design handoff screen 2). Server-rendered; the interactive MapLibre map replaces
 * the static one in PLAN P1-09. Every control that would need it is disabled, not faked.
 */
export async function FullMap() {
  const t = await getTranslations("Map");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;
  const h = HIGHWAY_DETAIL;
  const c = CRASH_DETAIL;

  const dots = CRASHES.map((x) => ({ key: x.slug, lon: x.lon, lat: x.lat, killed: x.killed, precise: x.precise }));
  const mapProps = {
    tone: "ink" as const,
    dots,
    risk: HIGHWAY_RISK,
    selected: h.ref,
    latest: { lon: LATEST.lon, lat: LATEST.lat },
    locale,
    title: t("legendHighway"),
  };

  const live = {
    tone: "ink" as const,
    locale,
    dots: dots.map((d) => ({ ...d, label: CRASHES.find((x) => x.slug === d.key)?.title[locale] })),
    risk: HIGHWAY_RISK,
    selected: h.ref,
    latest: { lon: LATEST.lon, lat: LATEST.lat },
    dotPath: "/crash",
    highwayLinks: [h.ref],
    text: liveMapText(t),
  };

  const stats = [
    { label: common("crashes"), value: h.stats.crashes, red: false },
    { label: common("killed"), value: h.stats.killed, red: true },
    { label: common("injured"), value: h.stats.injured, red: false },
  ];

  const highwayPanel = (
    <section aria-labelledby="hw-name" className="bg-bg text-ink">
      <header className="bg-accent-600 px-5 py-4 text-bg">
        <p className="label tracking-[0.08em]">{t("highwayLength", { ref: h.ref, km: fmtNum(h.lengthKm, locale) })}</p>
        <h2 id="hw-name" className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em]">{h.name[locale]}</h2>
        <p className="text-body opacity-90">{locale === "ne" ? h.name.en : h.name.ne}</p>
      </header>
      <dl className="grid grid-cols-3 border-b border-neutral-400">
        {stats.map((s) => (
          <div key={s.label} className="border-r border-neutral-400 px-4 py-3 last:border-r-0">
            <dt className="label text-neutral-700">{s.label}</dt>
            <dd className={`text-[28px] font-extrabold leading-[1.1] tabular ${s.red ? "text-accent-700" : ""}`}>{fmtNum(s.value, locale)}</dd>
          </div>
        ))}
      </dl>
      <div className="px-5 py-4">
        <h3 className="label text-neutral-700">{t("worstStretches")}</h3>
        <ol className="mt-2">
          {h.blackspots.slice(0, 5).map((b, i) => (
            <li key={b.km} className="flex items-baseline gap-3 border-b border-neutral-300 py-2 last:border-b-0">
              <span className="w-5 text-small font-extrabold text-neutral-700 tabular">{fmtNum(i + 1, locale)}</span>
              <span className="flex-1">
                <span className="block text-body font-semibold">{b.place[locale]}</span>
                <span className="block text-meta text-neutral-700">{common("km", { km: digits(b.km, locale) })}</span>
              </span>
              <span className="text-small font-extrabold text-accent-700">{common("killedCount", { count: fmtNum(b.killed, locale) })}</span>
            </li>
          ))}
        </ol>
        <Link href={`/highway/${h.ref}`} className="mt-3 flex min-h-11 items-center justify-center bg-ink px-4 text-ui font-extrabold text-bg no-underline hover:bg-accent-700 hover:text-bg">
          {t("openHighway")}
        </Link>
      </div>
    </section>
  );

  const filters = [t("fatalOnly"), t("vehicleAll"), t("crashTypeAll"), t("calendar")];

  return (
    <>
      {/* Desktop */}
      <div className="relative hidden h-[calc(100dvh-68px)] min-h-[600px] overflow-hidden bg-ink text-bg lg:block">
        <div className="absolute inset-x-0 bottom-[104px] top-0">
          <LiveMap {...live} view={{ kind: "country", padding: { top: 72, right: 96, bottom: 16, left: 400 } }} rail="full" railClassName="absolute right-6 top-1/2 -translate-y-1/2">
            <CityLayer tone="ink" className="w-[420px]" />
            <div className="absolute inset-[72px_96px_16px_400px]">
              <StaticMap {...mapProps} pxPerUnit={1.6} />
            </div>
          </LiveMap>
        </div>

        <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-4 px-6 py-4">
          {filters.map((f) => (
            <Disabled key={f} className="min-h-11 border border-neutral-600 bg-ink/80 px-4 text-ui font-semibold">{f} ▾</Disabled>
          ))}
          <a href="#list" className="ml-auto flex min-h-11 items-center border border-neutral-600 bg-ink/80 px-4 text-ui font-semibold text-bg no-underline hover:text-bg">{t("listView")}</a>
        </header>

        <div className="absolute left-6 top-20 z-20 w-[360px] shadow-lg">{highwayPanel}</div>

        <Scrubber locale={locale} periodLabel={t("period")} value={t("periodValue")} hint={t("periodHint")} />
      </div>

      {/* Phone */}
      <div className="relative h-[calc(100dvh-56px)] overflow-hidden bg-ink text-bg lg:hidden">
        <div className="absolute inset-[56px_0_470px_0]">
          <LiveMap {...live} view={{ kind: "country", padding: 12 }} cooperativeGestures rail="compact" railClassName="absolute right-3 top-3">
            <div className="absolute inset-[0_8px]">
              <StaticMap {...mapProps} labels={false} pxPerUnit={0.5} />
            </div>
          </LiveMap>
        </div>
        <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-2 px-3">
          <span className="flex min-h-11 flex-1 items-center border border-neutral-600 bg-ink/80 px-3 text-small text-neutral-400">{t("findPlace")}</span>
          <Disabled className="flex size-11 items-center justify-center border border-neutral-600 bg-bg text-ink"><span className="sr-only">{t("filters")}</span>≡</Disabled>
        </header>

        <section aria-labelledby="sheet-title" className="absolute inset-x-0 bottom-0 z-20 h-[470px] max-h-[75dvh] overflow-y-auto bg-bg text-ink shadow-lg">
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 bg-neutral-400" />
          <div className="px-4 pb-4 pt-3">
            <p className="label text-neutral-700">{t("crashLabel", { date: bsShort(LATEST.date, locale), time: digits(LATEST.time ?? "", locale) })}</p>
            <h2 id="sheet-title" className="mt-1 text-[22px] font-extrabold leading-[1.2]">{LATEST.title[locale]}</h2>
            <p className="text-small text-neutral-700">{LATEST.place[locale]}</p>
            <dl className="mt-3 grid grid-cols-3 border-y border-neutral-400">
              {[
                { label: common("killed"), value: LATEST.killed, red: true },
                { label: common("injured"), value: LATEST.injured, red: false },
                { label: common("onBoard"), value: LATEST.onBoard ?? 0, red: false },
              ].map((s) => (
                <div key={s.label} className="border-r border-neutral-400 py-2 pl-3 last:border-r-0">
                  <dt className="label text-neutral-700">{s.label}</dt>
                  <dd className={`text-[26px] font-extrabold tabular ${s.red ? "text-accent-700" : ""}`}>{fmtNum(s.value, locale)}</dd>
                </div>
              ))}
            </dl>
            <h3 className="label mt-4 text-neutral-700">{t("peopleKilled")}</h3>
            <ul className="mt-2 grid grid-cols-7 gap-1.5">
              {c.killedPeople.map((p, i) => (
                <li
                  key={i}
                  aria-label={p.name ? p.name[locale] : undefined}
                  className={`flex aspect-square items-center justify-center text-small font-extrabold ${p.name ? "bg-neutral-700 text-bg" : "border border-dashed border-neutral-600"}`}
                >
                  {p.name ? p.name[locale].charAt(0) : ""}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-meta text-neutral-700">
              {t("namedSummary", {
                named: fmtNum(c.killedPeople.filter((p) => p.name).length, locale),
                unnamed: fmtNum(c.notYetNamed, locale),
                outlets: fmtNum(c.verification.outlets, locale),
              })}
            </p>
          </div>
          <div className="sticky bottom-0 border-t-2 border-ink bg-bg p-3">
            <Link href={`/crash/${LATEST.slug}`} className="flex min-h-11 items-center justify-center bg-accent-600 px-4 text-ui font-extrabold text-bg no-underline hover:bg-accent-700 hover:text-bg">
              {t("fullCrashPage")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Scrubber({ locale, periodLabel, value, hint }: { locale: Locale; periodLabel: string; value: string; hint: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-[104px] items-stretch gap-8 border-t border-neutral-700 bg-ink/94 px-6 py-3">
      <div className="w-[220px] shrink-0">
        <p className="label text-neutral-400">{periodLabel}</p>
        <p className="mt-1 text-body font-extrabold">{value}</p>
        <p className="mt-1 text-meta text-neutral-500">{hint}</p>
      </div>
      <div className="flex flex-1 flex-col">
        <div role="img" aria-label={value} className="flex flex-1 items-end gap-[3px]">
          {WEEKLY_KILLED.map((n, i) => (
            <span
              key={i}
              className={`flex-1 ${i === WEEKLY_KILLED.length - 1 ? "bg-accent-500" : "bg-neutral-600"}`}
              style={{ height: `${Math.round((n / BARS_MAX) * 100)}%` }}
            />
          ))}
        </div>
        <div aria-hidden className="mt-1 flex justify-between text-meta text-neutral-500">
          {[1, 2, 3, 4, 5, 6, 7].map((m) => (
            <span key={m}>{bsMonthName(m, locale)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
