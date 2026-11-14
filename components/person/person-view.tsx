import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { FlameIcon } from "@/components/site/icons";
import { adShort, bsLong, fmtNum, type Locale } from "@/lib/format";
import type { PERSON_DETAIL, SampleCrash, SampleVictim } from "@/lib/sample/data";

type Detail = typeof PERSON_DETAIL;

/**
 * Person / memorial page (design handoff screen 4, SPEC 6.5). Sample data until PLAN P3-05.
 *
 * Only one sample person has a family-written page (`detail`); everyone else shows what the
 * news reported and says their story hasn't been written yet. Candles, tributes, sharing,
 * reporting and family claims come later (P3-02, P3-06, P3-07) and are shown disabled.
 * Videos and posts (click-to-load embeds, P3-04) are left out until they can really load.
 */
export async function PersonView({ victim, crash, detail }: { victim: SampleVictim; crash: SampleCrash; detail: Detail | null }) {
  const t = await getTranslations("Person");
  const common = await getTranslations("Common");
  const locale = (await getLocale()) as Locale;
  const other = locale === "ne" ? "en" : "ne";
  const initial = Array.from(victim.name[locale])[0];
  const ageHome = [victim.age != null ? fmtNum(victim.age, locale) : null, victim.home?.[locale]].filter(Boolean).join(" · ");

  const disabled = "btn btn-secondary cursor-not-allowed opacity-60";

  const identity = (
    <div className="flex flex-col px-4 py-6 lg:p-12 lg:pb-8">
      <p className="flex flex-wrap gap-2">
        <span className="tag bg-surface font-semibold">{t("killedTag")}</span>
        {victim.confirmedByFamily && (
          <span className="tag border border-ink font-semibold">
            {detail ? t("confirmed", { date: bsLong(detail.confirmedOn, locale) }) : t("confirmedShort")}
          </span>
        )}
      </p>
      <h1 className="mt-4 text-[36px] tracking-[-0.03em] lg:mt-5 lg:text-[64px]">{victim.name[locale]}</h1>
      <p className="text-[20px] text-neutral-700 lg:text-[30px]">{victim.name[other]}</p>
      <p className="mt-3 text-body text-neutral-800 lg:mt-4 lg:text-[16px]">
        {detail && (
          <>
            {t("knownAs")} <b>“{detail.alias[locale]}”</b> ·{" "}
          </>
        )}
        {ageHome}
      </p>
      <p className="mt-1 text-body text-neutral-800 lg:text-[16px]">
        {t("killedOn", { bs: bsLong(crash.date, locale), ad: adShort(crash.date, locale) })} ·{" "}
        <Link href={`/crash/${crash.slug}`} className="underline">{crash.title[locale]}</Link>
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4 border-t-2 border-ink pt-5 lg:mt-auto">
        {/* Candles need a device-per-day counter (P3-06). */}
        <button type="button" disabled aria-disabled className="btn btn-primary h-[52px] min-w-[220px] cursor-not-allowed gap-2.5 opacity-60">
          <FlameIcon /> {t("lightCandle")}
        </button>
        <p>
          <span className="block text-[24px] font-extrabold leading-none tabular">{fmtNum(victim.candles, locale)}</span>
          <span className="text-meta text-neutral-700">{t("candlesLit")}</span>
        </p>
        <span className="hidden flex-1 lg:block" />
        <button type="button" disabled aria-disabled className={disabled}>{common("share")}</button>
        <button type="button" disabled aria-disabled className="btn cursor-not-allowed opacity-60">{common("report")}</button>
      </div>
    </div>
  );

  return (
    <article>
      {/* Cover and identity */}
      <div className="border-b-2 border-ink lg:grid lg:grid-cols-[520px_1fr]">
        <div aria-hidden className="stripes relative h-[300px] border-b-2 border-ink lg:h-[600px] lg:border-b-0 lg:border-r-2">
          <span className="absolute left-5 top-4 text-[96px] font-extrabold leading-none text-neutral-400 lg:left-8 lg:top-6 lg:text-[160px]">{initial}</span>
          {detail && <span className="absolute bottom-4 left-5 text-meta font-semibold text-neutral-700 lg:left-6">{t("coverNote")}</span>}
        </div>
        {identity}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_400px]">
        {/* Main column */}
        <div className="lg:border-r-2 lg:border-ink">
          <section className="border-b-2 border-ink px-4 py-8 lg:px-12 lg:py-10">
            {detail ? (
              <>
                <h2 className="label mb-3 text-neutral-700">{detail.storyBy[locale]}</h2>
                <div className="max-w-[720px] space-y-4 text-story text-pretty">
                  {detail.story[locale].map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[22px] lg:text-h3">{t("storyPending")}</h2>
                <p className="mt-2 max-w-[64ch] text-body text-neutral-700">{t("storyPendingBody")}</p>
                {victim.quote && <p className="mt-4 max-w-[64ch] text-story">“{victim.quote[locale]}”</p>}
              </>
            )}
          </section>

          {detail && (
            <section aria-labelledby="photos-h" className="border-b-2 border-ink px-4 py-8 lg:px-12 lg:py-10">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 id="photos-h" className="text-[22px] lg:text-h2">{t("photos")}</h2>
                <span className="text-ui text-neutral-700">
                  {t("photosCount", { shown: fmtNum(detail.photos.length, locale), total: fmtNum(detail.photoCount, locale) })}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-3 lg:auto-rows-[180px] lg:grid-cols-[2fr_1fr_1fr]">
                {detail.photos.map((p, i) => (
                  <li key={i} className={`stripes flex h-[150px] items-end p-2.5 text-meta text-neutral-800 lg:h-auto ${i === 0 ? "col-span-2 lg:col-span-1 lg:row-span-2" : ""}`}>
                    {p[locale]}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {detail && (
            <section aria-labelledby="tributes-h" className="border-b-2 border-ink px-4 py-8 lg:border-b-0 lg:px-12 lg:py-10">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="tributes-h" className="text-[22px] lg:text-h2">{t("tributes")}</h2>
                {/* Tributes need login and review (P3-06). */}
                <button type="button" disabled aria-disabled className={`${disabled} h-10 min-h-10`}>{t("writeTribute")}</button>
              </div>
              <ul>
                {detail.tributes.map((tr, i) => (
                  <li key={i} className="border-t border-neutral-400 py-4">
                    <p className="max-w-[720px] text-[16px] leading-normal">{tr.body[locale]}</p>
                    <p className="mt-1.5 text-meta text-neutral-700">{tr.who[locale]}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right column */}
        <aside>
          <section className="border-b-2 border-ink p-4 lg:p-8">
            <h2 className="label mb-2 text-neutral-700">{t("whoThey")}</h2>
            <dl>
              {(detail
                ? detail.facts.map((f) => [f.k[locale], f.v[locale]] as const)
                : ([
                    victim.age != null ? [common("age"), fmtNum(victim.age, locale)] : null,
                    victim.home ? [common("hometown"), victim.home[locale]] : null,
                  ].filter(Boolean) as [string, string][])
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[100px_1fr] gap-3 border-t border-neutral-400 py-2.5 text-ui">
                  <dt className="text-neutral-700">{k}</dt>
                  <dd className="font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-b-2 border-ink p-4 lg:p-8">
            <h2 className="label mb-2 text-neutral-700">{t("theCrash")}</h2>
            <p className="text-[17px] font-extrabold leading-snug">{crash.title[locale]}</p>
            <p className="mt-1 text-ui text-neutral-700">
              {[crash.highwayRef && crash.km != null ? `${crash.highwayRef} · ${common("km", { km: fmtNum(crash.km, locale) })}` : null, crash.district[locale], bsLong(crash.date, locale)].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-ui">
              <b className="text-accent-700">{common("killedCount", { count: fmtNum(crash.killed, locale) })}</b>
              {" · "}{common("injuredCount", { count: fmtNum(crash.injured, locale) })}
            </p>
            <Link href={`/crash/${crash.slug}`} className="mt-3 inline-flex min-h-11 items-center text-ui font-semibold no-underline hover:underline">{t("crashPage")}</Link>
          </section>

          {detail && (
            <section className="border-b-2 border-ink p-4 lg:p-8">
              <h2 className="label mb-1 text-neutral-700">{t("newsSaid")}</h2>
              <p className="mb-2 text-small text-neutral-700">{t("newsSaidBody")}</p>
              <ul>
                {detail.spellings.map((s) => (
                  <li key={s.n + s.o} className="flex justify-between gap-3 border-t border-neutral-400 py-2.5 text-ui">
                    <b>{s.n}</b>
                    <span className="text-right text-meta text-neutral-700">{s.o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Family claims and memories go through review (P3-02). */}
          <div className="grid gap-2 p-4 lg:p-8">
            <button type="button" disabled aria-disabled className={`${disabled} h-12 w-full`}>{t("family")}</button>
            <button type="button" disabled aria-disabled className={`${disabled} h-12 w-full`}>{t("addMemory")}</button>
          </div>
        </aside>
      </div>
    </article>
  );
}
