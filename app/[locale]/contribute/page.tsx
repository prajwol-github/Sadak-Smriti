import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ContributorCard } from "@/components/contribute/contributor-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { ANONYMOUS_DONORS, CONTRIBUTORS, GROUPS } from "@/lib/contributors";
import { Link } from "@/lib/i18n/navigation";
import { fmtNum, type Locale } from "@/lib/format";
import { SITE_LINKS } from "@/lib/site-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contribute");
  return { title: t("metaTitle") };
}

/**
 * Contribute (SPEC 6.1 "/contribute": how to help) plus the people who help, in three groups:
 * code and design, reviewers and volunteers, donors (owner's request, 13 Nov 2026).
 * Listing is opt-in through content/contributors.json.
 */
export default async function ContributePage() {
  const t = await getTranslations("Contribute");
  const locale = (await getLocale()) as Locale;

  const ways: { key: "report" | "review" | "code" | "donate"; href: string | null; internal?: boolean }[] = [
    { key: "report", href: "/submit", internal: true },
    { key: "review", href: SITE_LINKS.contactEmail ? `mailto:${SITE_LINKS.contactEmail}` : null },
    { key: "code", href: SITE_LINKS.repo },
    { key: "donate", href: SITE_LINKS.donate },
  ];

  return (
    <>
      <SiteNav current="contribute" />
      <main id="content">
        <header className="border-b-2 border-ink px-4 py-8 lg:px-8 lg:py-12">
          <h1 className="text-[36px] lg:text-[56px]">{t("heading")}</h1>
          <p className="mt-3 max-w-[64ch] text-body text-neutral-700">{t("intro")}</p>
        </header>

        {/* Ways to help */}
        <section aria-labelledby="ways-h" className="border-b-2 border-ink">
          <h2 id="ways-h" className="sr-only">{t("waysHeading")}</h2>
          <ul className="grid sm:grid-cols-2 xl:grid-cols-4">
            {ways.map((w, i) => (
              <li key={w.key} className={`flex flex-col border-neutral-400 px-4 py-6 lg:px-8 lg:py-8 ${i < 3 ? "border-b sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r" : ""} ${i === 2 ? "sm:border-b-0" : ""}`}>
                <span aria-hidden className="text-[28px] font-extrabold text-accent-600 tabular">{fmtNum(i + 1, locale)}</span>
                <h3 className="mt-2 text-h4">{t(`ways.${w.key}.title`)}</h3>
                <p className="mt-2 flex-1 text-ui text-neutral-700">{t(`ways.${w.key}.body`)}</p>
                {w.href ? (
                  w.internal ? (
                    <Link href={w.href} className={`btn mt-5 self-start ${w.key === "report" ? "btn-primary" : "btn-secondary"}`}>{t(`ways.${w.key}.cta`)}</Link>
                  ) : (
                    <a href={w.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-5 self-start">{t(`ways.${w.key}.cta`)}</a>
                  )
                ) : (
                  <span className="mt-5 self-start text-small font-semibold text-neutral-700">{t("comingSoon")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* The people */}
        <section aria-labelledby="people-h" className="px-4 py-8 lg:px-8 lg:py-12">
          <h2 id="people-h" className="text-[28px] lg:text-h2">{t("peopleHeading")}</h2>
          <p className="mt-2 max-w-[64ch] text-ui text-neutral-700">{t("peopleBody")}</p>

          {GROUPS.map((g) => {
            const people = CONTRIBUTORS.filter((c) => c.roles.some((r) => g.roles.includes(r)));
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className="mt-10 border-t-2 border-ink pt-6">
                <h3 id={`g-${g.key}`} className="flex items-baseline gap-3 text-h3">
                  {t(`groups.${g.key}`)}
                  <span className="text-ui font-semibold text-neutral-700 tabular">{fmtNum(people.length, locale)}</span>
                </h3>
                {people.length ? (
                  <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {people.map((c) => <ContributorCard key={c.handle} c={c} />)}
                  </ul>
                ) : (
                  <p className="mt-4 text-ui text-neutral-700">{t("noneYet")}</p>
                )}
                {g.key === "donors" && ANONYMOUS_DONORS > 0 && (
                  <p className="mt-6 text-ui text-neutral-700">{t("anonymousDonors", { n: ANONYMOUS_DONORS, count: fmtNum(ANONYMOUS_DONORS, locale) })}</p>
                )}
              </section>
            );
          })}
          <p className="mt-10 text-meta text-neutral-700">{t("photoNote")}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
