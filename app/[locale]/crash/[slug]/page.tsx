import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { CrashView } from "@/components/crash/crash-view";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { ALL_CRASHES, CRASH_DETAIL } from "@/lib/sample/data";
import type { Locale } from "@/lib/format";

type Params = PageProps<"/[locale]/crash/[slug]">["params"];

/** Every sample crash has a page; unknown slugs are a 404. Real slugs and redirects come with PLAN P1-08. */
export function generateStaticParams() {
  return ALL_CRASHES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/crash/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const crash = ALL_CRASHES.find((c) => c.slug === slug);
  if (!crash) return {};
  const locale = (await getLocale()) as Locale;
  return { title: crash.title[locale] };
}

/**
 * Crash page (design handoff screen 3). Sample data until the database exists (PLAN P1-08).
 *
 * `params` is read inside <Suspense>, not here, so the nav and footer are part of the static
 * shell and client navigations to a crash stay instant (Next 16 Cache Components,
 * node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md).
 */
export default function CrashPage({ params }: PageProps<"/[locale]/crash/[slug]">) {
  return (
    <>
      <SiteNav />
      <main id="content">
        <Suspense fallback={<CrashFallback />}>
          <Crash params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Crash({ params }: { params: Params }) {
  const { slug } = await params;
  const crash = ALL_CRASHES.find((c) => c.slug === slug);
  if (!crash) notFound();
  const detail = crash.slug === CRASH_DETAIL.crash.slug ? CRASH_DETAIL : null;
  return <CrashView crash={crash} detail={detail} />;
}

async function CrashFallback() {
  const t = await getTranslations("Common");
  return (
    <div role="status" aria-busy="true" className="min-h-[60dvh]">
      <p className="sr-only">{t("loading")}</p>
      <div aria-hidden className="stripes h-[220px] border-b-2 border-ink" />
    </div>
  );
}
