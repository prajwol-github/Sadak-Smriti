import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { CRASHES, NEWS, POLICE_DISTRICTS, POLICE_REPORTS, REMEMBERED, SAMPLE_TODAY } from "@/lib/sample/data";
import { adToBs } from "@/lib/domain/bs-date";
import { bsLong, bsShort, digits, fmtNum, weekdayShort, type Locale } from "@/lib/format";

/** Two-column ruled section: a 360px intro column, then the content (README Home 1–2). */
function RuledSection({ id, heading, intro, link, children }: { id: string; heading: string; intro: string; link?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-b-2 border-ink lg:grid lg:grid-cols-[360px_1fr]">
      <div className="px-4 pb-2 pt-6 lg:border-r-2 lg:border-ink lg:px-8 lg:py-12">
        <h2 id={id} className="text-[22px] lg:mb-3 lg:text-h2">{heading}</h2>
        <p className="hidden text-body leading-normal text-neutral-700 lg:block">{intro}</p>
        {link}
      </div>
      {children}
    </section>
  );
}

export async function RememberedToday() {
  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;
  const today = adToBs(SAMPLE_TODAY);
  return (
    <RuledSection
      id="remembered"
      heading={t("rememberedHeading")}
      intro={t("rememberedBody", { date: bsShort(SAMPLE_TODAY, locale) })}
      link={<Link href="/remember" className="mt-5 hidden min-h-11 items-center text-ui font-semibold no-underline lg:inline-flex">{t("rememberedLink")}</Link>}
    >
      <ul className="px-4 pb-6 lg:grid lg:grid-cols-3 lg:p-0">
        {REMEMBERED.map((p) => {
          const years = today.year - adToBs(p.diedOn).year;
          const initial = Array.from(p.name[locale])[0];
          return (
            <li key={p.slug} className="border-t border-neutral-400 lg:border-r lg:border-t-0 lg:last:border-r-0">
              <Link href={`/person/${p.slug}`} className="grid grid-cols-[72px_1fr] gap-3.5 py-3 no-underline lg:flex lg:flex-col lg:gap-0 lg:py-0">
                <span aria-hidden className="stripes block h-[88px] p-1.5 text-[24px] font-extrabold text-neutral-500 lg:h-[300px] lg:p-4 lg:text-[56px]">{initial}</span>
                <span className="flex flex-col gap-1.5 lg:px-6 lg:py-5">
                  <span className="text-body font-extrabold lg:text-[22px] lg:leading-[1.15]">{p.name[locale]}</span>
                  <span className="text-meta text-neutral-700 lg:text-ui">
                    <span className="hidden lg:inline">{p.name[locale === "ne" ? "en" : "ne"]} · </span>
                    {fmtNum(p.age, locale)} · {p.home[locale]}
                  </span>
                  {p.quote && <span className="text-small leading-snug lg:mt-1.5 lg:text-ui lg:leading-normal">“{p.quote[locale]}”</span>}
                  <span className="hidden text-meta text-neutral-700 lg:mt-2 lg:block">
                    {t("yearsAgo", { count: years, date: bsLong(p.diedOn, locale) })} · {fmtNum(p.candles, locale)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </RuledSection>
  );
}

export async function ThisWeek() {
  const t = await getTranslations("Home");
  const vehicle = await getTranslations("Vehicle");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;

  const days: { date: string; items: typeof CRASHES }[] = [];
  for (const c of CRASHES.slice(0, 7)) {
    const day = days.find((d) => d.date === c.date);
    if (day) day.items.push(c);
    else days.push({ date: c.date, items: [c] });
  }
  const road = (c: (typeof CRASHES)[number]) =>
    `${c.district[locale]} · ${c.highwayRef ? `${c.highwayRef} ${common("km", { km: fmtNum(c.km ?? 0, locale) })}` : common("notHighway")}`;
  const vehicles = (c: (typeof CRASHES)[number]) => c.vehicles.map((v) => vehicle(v)).join(", ");

  return (
    <RuledSection id="week" heading={t("weekHeading")} intro={t("weekBody")}>
      {/* Desktop: timeline with a 2px ink line and square nodes. */}
      <ol className="hidden py-8 pl-10 pr-8 lg:block">
        {days.map((d) => (
          <li key={d.date} className="grid grid-cols-[120px_24px_1fr] gap-x-4">
            <span className="py-3 text-body font-extrabold">{weekdayShort(d.date, locale)} {bsShort(d.date, locale)}</span>
            <span aria-hidden className="flex flex-col items-center">
              <span className="h-4 w-0.5 bg-ink" />
              <span className="size-3 bg-ink" />
              <span className="w-0.5 flex-1 bg-ink" />
            </span>
            <ul className="grid gap-2 pb-5 pt-2">
              {d.items.map((c) => (
                <li key={c.slug}>
                  <Link href={`/crash/${c.slug}`} className="grid grid-cols-[1fr_160px_110px] items-baseline border-b border-neutral-400 py-2 no-underline">
                    <span>
                      <b className="text-body">{c.place[locale]}</b> <span className="text-small text-neutral-700">· {road(c)}</span>
                    </span>
                    <span className="text-small text-neutral-700">{vehicles(c)}</span>
                    <span className="text-right font-extrabold text-accent-700">{common("killedCount", { count: fmtNum(c.killed, locale) })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {/* Phone: a flat list. */}
      <ul className="px-4 pb-6 lg:hidden">
        {CRASHES.slice(0, 5).map((c) => (
          <li key={c.slug}>
            <Link href={`/crash/${c.slug}`} className="grid grid-cols-[12px_1fr_auto] gap-3 border-b border-neutral-400 py-2.5 no-underline">
              <span aria-hidden className="mt-[5px] size-2.5 bg-ink" />
              <span>
                <span className="block text-ui font-semibold">{c.place[locale]}</span>
                <span className="block text-meta text-neutral-700">{bsShort(c.date, locale)} · {vehicles(c)}</span>
              </span>
              <b className="text-accent-700">{fmtNum(c.killed, locale)}</b>
            </Link>
          </li>
        ))}
      </ul>
    </RuledSection>
  );
}

export async function InTheNews() {
  const t = await getTranslations("Home");
  const kind = await getTranslations("Kind");
  const locale = (await getLocale()) as Locale;
  return (
    <section aria-labelledby="news" className="border-b-2 border-ink px-4 py-6 lg:px-8 lg:py-10">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h2 id="news" className="text-[22px] lg:text-h2">{t("newsHeading")}</h2>
          <p className="mt-1 hidden text-ui text-neutral-700 lg:block">{t("newsBody")}</p>
        </div>
        <Link href="/crashes" className="hidden min-h-11 items-center text-ui font-semibold no-underline lg:flex">{t("allSources")}</Link>
      </div>
      <ul className="lg:grid lg:grid-cols-4 lg:border-t-2 lg:border-ink">
        {NEWS.map((n, i) => (
          <li key={i} className={`border-b border-neutral-400 py-3 lg:mr-5 lg:flex lg:min-h-[170px] lg:flex-col lg:gap-2.5 lg:border-b-0 lg:border-r lg:py-4 lg:pr-5 ${i > 2 ? "hidden lg:flex" : ""}`}>
            <span className="label flex justify-between text-neutral-700">
              <span>{n.outlet}<span className="lg:hidden"> · {bsShort(n.date, locale)}</span></span>
              <span className="hidden lg:inline">{n.lang}</span>
            </span>
            <a href="#" lang={n.lang === "NE" ? "ne" : "en"} className="mt-1 block text-body font-semibold leading-[1.35] no-underline hover:underline lg:mt-0 lg:flex-1 lg:text-[16px]">
              {n.title[locale]} ↗
            </a>
            <span className="hidden text-meta text-neutral-700 lg:block">{bsShort(n.date, locale)} · {kind(n.kind)}</span>
            <Link href={`/crash/${n.crash.slug}`} className="hidden border-t border-neutral-400 pt-2 text-meta font-semibold no-underline lg:block">
              {t("newsCrash", { place: n.crash.place[locale].split(",")[0] })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function PoliceStatistics() {
  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;
  const year = digits("81/82", locale);
  const rows = POLICE_DISTRICTS.map((p) => ({ ...p, cov: Math.round((p.here / p.police) * 100) }));
  return (
    <section className="border-b-2 border-ink lg:grid lg:grid-cols-[1.4fr_1fr]">
      <div className="px-4 py-6 lg:border-r-2 lg:border-ink lg:px-8 lg:py-10">
        <h2 className="text-[22px] lg:text-h2">{t("policeHeading")}</h2>
        <p className="mb-2 mt-1 text-meta text-neutral-700 lg:mb-4 lg:text-ui">
          <span className="hidden lg:inline">{t("policeBody")}</span>
          <span className="lg:hidden">{t("policeMobileBody", { year: digits("2081/82", locale) })}</span>
        </p>
        {/* Desktop table */}
        <table className="hidden w-full border-collapse text-ui lg:table">
          <thead>
            <tr className="label border-b-2 border-ink text-neutral-700">
              <th scope="col" className="py-2 text-left font-semibold">{t("colDistrict")}</th>
              <th scope="col" className="w-[130px] py-2 text-right font-semibold">{t("colPolice", { year })}</th>
              <th scope="col" className="w-[130px] py-2 text-right font-semibold">{t("colHere")}</th>
              <th scope="col" className="w-[140px] py-2 text-right font-semibold">{t("colCoverage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.district.en} className="border-b border-neutral-400">
                <th scope="row" className="py-[11px] text-left font-extrabold">{p.district[locale]}</th>
                <td className="text-right tabular">{fmtNum(p.police, locale)}</td>
                <td className="text-right font-extrabold text-accent-700 tabular">{fmtNum(p.here, locale)}</td>
                <td>
                  <span className="flex items-center justify-end gap-2">
                    <span aria-hidden className="h-1.5 w-[70px] bg-neutral-300"><span className="block h-1.5 bg-ink" style={{ width: `${p.cov}%` }} /></span>
                    <b className="w-9 text-right tabular">{fmtNum(p.cov, locale)}%</b>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Phone bars */}
        <ul className="lg:hidden">
          {rows.slice(0, 3).map((p) => (
            <li key={p.district.en} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-neutral-400 py-2.5 text-ui">
              <b>{p.district[locale]}</b>
              <b>{fmtNum(p.cov, locale)}%</b>
              <span aria-hidden className="col-span-2 h-1.5 bg-neutral-300"><span className="block h-1.5 bg-ink" style={{ width: `${p.cov}%` }} /></span>
              <span className="text-meta text-neutral-700">{t("policeRecorded", { here: fmtNum(p.here, locale), police: fmtNum(p.police, locale) })}</span>
            </li>
          ))}
        </ul>
        <Link href="/data" className="mt-3 flex min-h-11 items-center text-small font-semibold no-underline lg:hidden">{t("reportsLink")}</Link>
      </div>
      <div className="hidden px-8 py-10 lg:block">
        <h2 className="mb-4 text-h2">{t("reportsHeading")}</h2>
        <ul>
          {POLICE_REPORTS.map((b) => (
            <li key={b.title.en} className="flex gap-4 border-t border-neutral-400 py-3.5">
              <span className="flex h-14 w-11 flex-none items-center justify-center border-2 border-ink text-label font-extrabold">{b.type}</span>
              <span className="flex-1">
                <span className="block text-body font-semibold leading-[1.3]">{b.title[locale]}</span>
                <span className="mt-1 block text-meta text-neutral-700">{b.source[locale]} · {b.date[locale]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export async function CallsToAction() {
  const t = await getTranslations("Home");
  return (
    <section className="bg-ink text-bg lg:grid lg:grid-cols-2">
      <div className="px-4 py-7 lg:border-r-2 lg:border-neutral-700 lg:px-8 lg:py-12">
        <h2 className="max-w-[460px] text-[24px] leading-[1.15] lg:text-h2">{t("ctaReportHeading")}</h2>
        <p className="my-2 max-w-[460px] text-ui text-neutral-400 lg:mb-6 lg:mt-3 lg:text-body">
          <span className="hidden lg:inline">{t("ctaReportBody")}</span>
          <span className="lg:hidden">{t("ctaReportBodyShort")}</span>
        </p>
        <div className="flex flex-col gap-3 lg:flex-row">
          <Link href="/submit" className="btn btn-light min-h-12 lg:min-w-[200px]">{t("ctaReport")}</Link>
          <Link href="/submit/tip" className="btn hidden border-2 border-bg text-bg hover:bg-neutral-800 hover:text-bg lg:inline-flex">{t("ctaTip")}</Link>
        </div>
      </div>
      <div className="px-4 pb-7 lg:px-8 lg:py-12">
        <div className="border-t border-neutral-700 pt-6 lg:border-0 lg:pt-0">
          <h2 className="max-w-[460px] text-[24px] leading-[1.15] lg:text-h2">{t("ctaMemoryHeading")}</h2>
          <p className="my-2 max-w-[460px] text-ui text-neutral-400 lg:mb-6 lg:mt-3 lg:text-body">{t("ctaMemoryBody")}</p>
          <Link href="/contribute" className="btn min-h-12 border-2 border-bg text-bg hover:bg-neutral-800 hover:text-bg lg:btn-light lg:min-w-[200px] lg:border-0">{t("ctaMemory")}</Link>
        </div>
      </div>
    </section>
  );
}
