import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Carousel } from "@/components/remember/carousel";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { FlameIcon } from "@/components/site/icons";
import { Link } from "@/lib/i18n/navigation";
import { adToBs, isSameBsDayAndMonth } from "@/lib/domain/bs-date";
import { bsLong, fmtNum, type Locale } from "@/lib/format";
import { CRASH_DETAIL, LATEST, MEMORIAL_CRASHES, SAMPLE_TODAY, VICTIMS, type SampleCrash, type SampleVictim } from "@/lib/sample/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Remember");
  return { title: t("metaTitle") };
}

interface Group {
  crash: SampleCrash;
  victims: SampleVictim[];
  notYetNamed: number;
  withheld: number;
  /** Years since the crash, when its BS day and month are today's. */
  anniversary: number | null;
}

/**
 * Sample data until the database exists (PLAN P4-08). Only named people with a memorial are
 * listed; people not yet named, and names hidden at a family's request, are counted, never shown.
 */
function groups(): Group[] {
  const today = adToBs(SAMPLE_TODAY);
  return [LATEST, ...MEMORIAL_CRASHES].map((crash) => {
    const victims = VICTIMS.filter((v) => v.crashSlug === crash.slug);
    const withheld = crash.slug === LATEST.slug ? CRASH_DETAIL.killedPeople.filter((p) => !p.name && p.withheld).length : 0;
    const years = today.year - adToBs(crash.date).year;
    return {
      crash,
      victims,
      withheld,
      notYetNamed: Math.max(0, crash.killed - victims.length - withheld),
      anniversary: years > 0 && isSameBsDayAndMonth(crash.date, SAMPLE_TODAY) ? years : null,
    };
  });
}

/** Remember (SPEC 6.7): each crash with its headline, then the people killed in it. */
export default async function RememberPage() {
  const t = await getTranslations("Remember");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;
  const other = locale === "ne" ? "en" : "ne";

  return (
    <>
      <SiteNav current="remember" />
      <main id="content">
        <header className="border-b-2 border-ink px-4 py-8 lg:px-8 lg:py-12">
          <h1 className="text-[36px] lg:text-[56px]">{t("heading")}</h1>
          <p className="mt-3 max-w-[64ch] text-body text-neutral-700">{t("intro")}</p>
        </header>

        {groups().map((g) => (
          <section key={g.crash.slug} aria-labelledby={`h-${g.crash.slug}`} className="border-b-2 border-ink lg:grid lg:grid-cols-[360px_1fr]">
            {/* The crash */}
            <div className="px-4 pb-4 pt-6 lg:border-r-2 lg:border-ink lg:px-8 lg:py-10">
              <p className="flex flex-wrap items-center gap-2 text-small text-neutral-700">
                <span>{bsLong(g.crash.date, locale)}</span>
                {g.anniversary && <span className="tag bg-ink font-semibold text-bg">{t("anniversary", { count: g.anniversary })}</span>}
              </p>
              <h2 id={`h-${g.crash.slug}`} className="mt-2 text-[24px] leading-tight lg:text-h3">
                <Link href={`/crash/${g.crash.slug}`} className="no-underline hover:underline">
                  {g.crash.title[locale]}
                </Link>
              </h2>
              <p className="mt-2 text-small text-neutral-700">
                {g.crash.place[locale]} · {g.crash.district[locale]}
              </p>
              <p className="mt-2 text-ui">
                <b className="text-accent-700">{common("killedCount", { count: fmtNum(g.crash.killed, locale) })}</b>
                {" · "}{common("injuredCount", { count: fmtNum(g.crash.injured, locale) })}
              </p>
              <Link href={`/crash/${g.crash.slug}`} className="mt-4 inline-flex min-h-11 items-center text-ui font-semibold no-underline hover:underline">
                {t("openCrash")} →
              </Link>
            </div>

            {/* The people */}
            {/* min-w-0: a grid column would otherwise grow to the carousel's full width */}
            <div className="min-w-0 pb-6 lg:py-10">
              <Carousel label={`${t("carouselLabel")}: ${g.crash.title[locale]}`} previous={t("previous")} next={t("next")}>
                {g.victims.map((v) => (
                  <li key={v.slug} className="w-[200px] shrink-0 snap-start lg:w-[220px]">
                    <Link href={`/person/${v.slug}`} className="group block no-underline">
                      <span aria-hidden className="stripes block h-[240px] border-2 border-transparent p-3 text-[56px] font-extrabold leading-none text-neutral-500 group-hover:border-ink lg:h-[260px]">
                        {Array.from(v.name[locale])[0]}
                      </span>
                      <span className="mt-3 block text-body font-extrabold leading-tight group-hover:underline">{v.name[locale]}</span>
                      <span className="block text-small text-neutral-700">{v.name[other]}</span>
                      <span className="mt-1 block text-small text-neutral-700">
                        {[v.age != null ? fmtNum(v.age, locale) : null, v.home?.[locale]].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-2 flex items-center gap-2 text-meta text-neutral-700">
                        <FlameIcon size={14} />
                        {t("candles", { count: fmtNum(v.candles, locale) })}
                        {v.confirmedByFamily && <span className="font-semibold text-ink">{t("confirmed")}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
                {g.notYetNamed > 0 && (
                  <li className="w-[200px] shrink-0 snap-start lg:w-[220px]">
                    <span className="flex h-[240px] items-end border border-dashed border-neutral-600 p-3 text-small font-semibold text-neutral-700 lg:h-[260px]">
                      {t("notYetNamed", { n: g.notYetNamed, count: fmtNum(g.notYetNamed, locale) })}
                    </span>
                  </li>
                )}
                {g.withheld > 0 && (
                  <li className="w-[200px] shrink-0 snap-start lg:w-[220px]">
                    <span className="flex h-[240px] items-end border border-neutral-600 bg-neutral-200 p-3 text-small font-semibold text-neutral-700 lg:h-[260px]">
                      {t("withheld", { n: g.withheld, count: fmtNum(g.withheld, locale) })}
                    </span>
                  </li>
                )}
              </Carousel>
            </div>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
