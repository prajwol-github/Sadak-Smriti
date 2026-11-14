import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PersonView } from "@/components/person/person-view";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { ALL_CRASHES, PERSON_DETAIL, VICTIMS } from "@/lib/sample/data";
import type { Locale } from "@/lib/format";

type Params = PageProps<"/[locale]/person/[slug]">["params"];

/** Every named sample person has a page; anyone else is a 404 (hidden names never get one). */
export function generateStaticParams() {
  return VICTIMS.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/person/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const v = VICTIMS.find((x) => x.slug === slug);
  if (!v) return {};
  const t = await getTranslations("Person");
  const locale = (await getLocale()) as Locale;
  return { title: t("metaTitle", { name: v.name[locale] }) };
}

/** Person / memorial page (design handoff screen 4). Sample data until PLAN P3-05. `params` is read inside <Suspense> (see the crash page). */
export default function PersonPage({ params }: PageProps<"/[locale]/person/[slug]">) {
  return (
    <>
      <SiteNav current="remember" />
      <main id="content">
        <Suspense fallback={<div aria-busy="true" className="stripes min-h-[60dvh]" />}>
          <Person params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Person({ params }: { params: Params }) {
  const { slug } = await params;
  const victim = VICTIMS.find((v) => v.slug === slug);
  const crash = victim && ALL_CRASHES.find((c) => c.slug === victim.crashSlug);
  if (!victim || !crash) notFound();
  return <PersonView victim={victim} crash={crash} detail={slug === PERSON_DETAIL.slug ? PERSON_DETAIL : null} />;
}
