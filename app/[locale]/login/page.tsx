import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { googleSignInConfigured } from "@/lib/auth/server";
import { signInWithGoogle } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("loginMetaTitle"), robots: { index: false } };
}

/** Sign in (ADR 0006): Google only. A plain form, so it works without JavaScript. */
export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <div className="mx-auto max-w-xl px-4 py-10 lg:py-16">
          <h1 className="text-[32px] lg:text-[44px]">{t("loginTitle")}</h1>
          <p className="mt-3 text-body text-neutral-700">{t("loginIntro")}</p>
          <Suspense fallback={<div aria-busy="true" className="mt-8 h-12 max-w-[320px] bg-neutral-300" />}>
            <SignInForm searchParams={searchParams} />
          </Suspense>
          <p className="mt-6 text-small text-neutral-700">{t("privacy")}</p>
        </div>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function SignInForm({ searchParams }: { searchParams: PageProps<"/[locale]/login">["searchParams"] }) {
  await connection(); // the Google keys are read on the server at request time, not at build
  const [t, locale, { error }] = await Promise.all([getTranslations("Auth"), getLocale(), searchParams]);
  const configured = googleSignInConfigured();
  const message = !configured || error === "config" ? t("notConfigured") : error ? t("failed") : null;
  return (
    <>
      {message && (
        <p role="alert" className="mt-6 border-2 border-accent-700 bg-accent-100 px-4 py-3 text-body font-semibold">{message}</p>
      )}
      <form action={signInWithGoogle} className="mt-8">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={!configured} className="btn btn-primary h-12 min-w-[280px] text-body disabled:opacity-60">
          {t("google")} →
        </button>
      </form>
    </>
  );
}
