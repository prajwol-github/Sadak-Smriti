import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { Link } from "@/lib/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("TwoFactor");
  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * The authenticator-app step for reviewers and admins (ADR 0006). Anyone else gets the ordinary
 * not-found page.
 */
export default function TwoFactorPage() {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <div className="mx-auto max-w-xl px-4 py-10 lg:py-16">
          <Suspense fallback={<div aria-busy="true" className="h-40 bg-neutral-300" />}>
            <Step />
          </Suspense>
        </div>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Step() {
  const [access, locale, auth] = await Promise.all([staffAccess(), getLocale(), getTranslations("Auth")]);
  if (access.kind === "none") notFound();
  if (access.kind === "ok") {
    return <Link href="/review" className="btn btn-primary h-12 text-body">{auth("openReview")} →</Link>;
  }
  return <TwoFactorForm hasApp={!!access.session.user.twoFactorEnabled} locale={locale} />;
}
