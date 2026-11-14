import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { CreateCrashForm } from "@/components/review/edit-forms";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { listDistricts } from "@/lib/db/queries/places";
import { run } from "@/lib/db/queries/run";
import { type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Edit");
  return { title: t("createMeta"), robots: { index: false } };
}

/**
 * Staff-only form for creating a new crash record directly (ADR 0008 "create_crash").
 * Reviewers and admins only; redirects to the edit page after creation.
 */
export default function NewCrashPage() {
  return (
    <>
      <Suspense fallback={<div className="h-[68px] bg-ink" />}>
        <SiteNav />
      </Suspense>
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <NewCrash />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function NewCrash() {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  const { actor } = access;
  if (can(actor, "create_crash").kind !== "allow") notFound();

  const [t, locale, districtRows] = await Promise.all([
    getTranslations("Edit"),
    getLocale() as Promise<Locale>,
    run(listDistricts, {}),
  ]);
  const ne = locale === "ne";
  const districts = districtRows
    .map((d) => ({ id: d.id, name: ne ? d.nameNp : d.nameEn }))
    .sort((a, b) => a.name.localeCompare(b.name, ne ? "ne" : "en"));

  return (
    <>
      <StaffNav current="crashes" canSeeAccounts={can(actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link href="/review/crashes" className="text-small font-semibold">{t("back")}</Link>
        <h1 className="mt-3 text-[28px] lg:text-[40px]">{t("createHeading")}</h1>
        <p className="mt-1 max-w-[72ch] text-body text-neutral-700">{t("createIntro")}</p>
        <CreateCrashForm districts={districts} locale={locale} />
      </div>
    </>
  );
}
