import type { Metadata } from "next";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { isStaffRole, roleOf } from "@/lib/auth/actor";
import { readSession } from "@/lib/auth/session";
import { Link } from "@/lib/i18n/navigation";
import { signOut } from "../login/actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("accountMetaTitle"), robots: { index: false } };
}

/** The signed-in user's own account (ADR 0006). Shows their own role to them, and nobody else's. */
export default function AccountPage() {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <div className="mx-auto max-w-xl px-4 py-10 lg:py-16">
          <Suspense fallback={<div aria-busy="true" className="h-40 bg-neutral-300" />}>
            <Account />
          </Suspense>
        </div>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Account() {
  const [t, nav, locale, s] = await Promise.all([getTranslations("Auth"), getTranslations("Nav"), getLocale(), readSession()]);
  if (!s) {
    return (
      <>
        <h1 className="text-[32px] lg:text-[44px]">{t("accountTitle")}</h1>
        <p className="mt-3 text-body">{t("notSignedIn")}</p>
        <Link href="/login" className="btn btn-primary mt-6 h-12 text-body">{t("loginTitle")} →</Link>
      </>
    );
  }
  const role = roleOf(s.user.role);
  return (
    <>
      <h1 className="text-[32px] lg:text-[44px]">{t("accountTitle")}</h1>
      <p className="mt-3 text-body">{t("signedInAs", { name: s.user.name })}</p>
      <p className="text-small text-neutral-700">{s.user.email}</p>
      <dl className="mt-6 border-y border-neutral-400 py-3">
        <dt className="label text-neutral-700">{t("roleLabel")}</dt>
        <dd className="text-body font-semibold">{t(`role.${role}`)}</dd>
      </dl>
      {s.user.bannedAt && <p role="alert" className="mt-6 border-2 border-accent-700 bg-accent-100 px-4 py-3 text-body font-semibold">{t("deactivatedNotice")}</p>}
      {s.user.bannedAt ? null : isStaffRole(role) ? (
        <Link href="/review" className="btn btn-primary mt-6 h-12 text-body">{t("openReview")} →</Link>
      ) : (
        <p className="mt-6 text-body">
          {t("contributorNext")} <Link href="/submit" className="font-semibold">{nav("reportCrash")} →</Link>
        </p>
      )}
      <form action={signOut} className="mt-8">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="btn btn-secondary h-11">{t("signOut")}</button>
      </form>
    </>
  );
}
