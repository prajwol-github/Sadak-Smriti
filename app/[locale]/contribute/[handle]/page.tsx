import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ContributorLinks, ContributorPhoto } from "@/components/contribute/contributor-card";
import { ShareCard, type CardData } from "@/components/contribute/share-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { CONTRIBUTORS, contributorByHandle } from "@/lib/contributors";
import type { Highlight } from "@/lib/contributors/schema";
import { Link } from "@/lib/i18n/navigation";
import { adShort, bsLong, fmtNum, type Locale } from "@/lib/format";

type Params = PageProps<"/[locale]/contribute/[handle]">["params"];

export function generateStaticParams() {
  return CONTRIBUTORS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/contribute/[handle]">): Promise<Metadata> {
  const c = contributorByHandle((await params).handle);
  if (!c) return {};
  const locale = (await getLocale()) as Locale;
  return { title: locale === "ne" && c.name.ne ? c.name.ne : c.name.en };
}

/** A contributor's page with their share card. `params` is read inside <Suspense> (see the crash page). */
export default function ContributorPage({ params }: PageProps<"/[locale]/contribute/[handle]">) {
  return (
    <>
      <SiteNav current="contribute" />
      <main id="content">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Profile params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Profile({ params }: { params: Params }) {
  const c = contributorByHandle((await params).handle);
  if (!c) notFound();
  const t = await getTranslations("Contribute");
  const locale = (await getLocale()) as Locale;
  const name = locale === "ne" && c.name.ne ? c.name.ne : c.name.en;
  const other = locale === "ne" ? c.name.en : (c.name.ne ?? null);
  const roles = c.roles.map((r) => t(`roles.${r}`)).join(" · ");
  const highlights = (Object.entries(c.highlights) as [Highlight, number][]).map(
    ([k, v]) => [fmtNum(v, locale), t(`highlights.${k}`, { n: v, count: fmtNum(v, locale) })] as [string, string],
  );
  // The card shows the number big and the words beside it: drop the number from the label.
  const cardHighlights = highlights.map(([num, label]) => [num, label.replace(num, "").trim()] as [string, string]);

  const card: CardData = {
    handle: c.handle,
    name,
    otherName: other,
    roles,
    highlights: cardHighlights,
    since: t("since", { date: bsLong(c.since, locale) }),
    photo: c.photo ?? null,
    initial: Array.from(name)[0],
    kicker: t("cardKicker"),
    tagline: t("cardTagline"),
    path: `/${locale}/contribute/${c.handle}`,
    shareText: t("shareText"),
  };

  return (
    <article className="lg:grid lg:grid-cols-[1fr_420px]">
      <div className="border-b-2 border-ink px-4 py-8 lg:border-b-0 lg:border-r-2 lg:px-8 lg:py-12">
        <Link href="/contribute" className="inline-flex min-h-11 items-center text-small font-semibold no-underline hover:underline">{t("backToAll")}</Link>
        <div className="mt-4 grid gap-6 sm:grid-cols-[240px_1fr] sm:items-start">
          <ContributorPhoto c={c} size={480} className="border-2 border-ink" />
          <div>
            <p className="flex flex-wrap gap-2">
              {c.roles.map((r) => <span key={r} className="tag border border-ink font-semibold">{t(`roles.${r}`)}</span>)}
              {c.sample && <span className="tag border border-neutral-500 text-neutral-700">{t("sample")}</span>}
            </p>
            <h1 className="mt-4 text-[36px] tracking-[-0.02em] lg:text-[56px]">{name}</h1>
            {other && <p className="text-[20px] text-neutral-700 lg:text-[26px]">{other}</p>}
            <p className="mt-3 text-small text-neutral-700">
              {t("since", { date: bsLong(c.since, locale) })} · {adShort(c.since, locale)}
            </p>
            {c.bio && <p className="mt-4 max-w-[56ch] text-story">{locale === "ne" && c.bio.ne ? c.bio.ne : c.bio.en}</p>}
            <div className="mt-3"><ContributorLinks c={c} /></div>
          </div>
        </div>
        {highlights.length > 0 && (
          <dl className="mt-10 grid grid-cols-2 border-t-2 border-ink sm:grid-cols-3">
            {highlights.map(([num, label]) => (
              <div key={label} className="border-b border-r border-neutral-400 py-4 pr-4 last:border-r-0">
                <dt className="sr-only">{label}</dt>
                <dd className="text-[40px] font-extrabold leading-none tabular">{num}</dd>
                <dd className="mt-1.5 text-small text-neutral-700">{label.replace(num, "").trim()}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <aside aria-labelledby="share-h" className="px-4 py-8 lg:px-8 lg:py-12">
        <h2 id="share-h" className="text-h3">{t("shareHeading")}</h2>
        <p className="mt-2 text-small text-neutral-700">{t("shareBody")}</p>
        <div className="mt-5">
          <ShareCard
            data={card}
            labels={{ story: t("story"), square: t("square"), share: t("share"), download: t("download"), copyLink: t("copyLink"), copied: t("copied"), making: t("making") }}
          />
        </div>
      </aside>
    </article>
  );
}
