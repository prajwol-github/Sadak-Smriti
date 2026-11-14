import { getLocale, getTranslations } from "next-intl/server";
import { signOut } from "@/app/[locale]/login/actions";
import { Link } from "@/lib/i18n/navigation";

/**
 * The bar at the top of every staff page (review, accounts): where to go, and Sign out. Server
 * component; the sign-out form works without JavaScript. Staff pages only: the public header
 * never reads the session, so public pages stay static (ADR 0006).
 */
export async function StaffNav({ current, canSeeAccounts }: { current: "news" | "submissions" | "crashes" | "accounts"; canSeeAccounts: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("StaffNav"), getLocale()]);
  const link = (active: boolean) =>
    `flex min-h-11 items-center px-3 text-ui font-semibold no-underline hover:underline ${active ? "border-b-2 border-ink" : "text-neutral-700"}`;
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center gap-x-2 border-b border-neutral-400 px-4 lg:px-8">
      <Link href="/review" className={link(current === "news")} aria-current={current === "news" ? "page" : undefined}>{t("news")}</Link>
      <Link href="/review/submissions" className={link(current === "submissions")} aria-current={current === "submissions" ? "page" : undefined}>{t("submissions")}</Link>
      <Link href="/review/crashes" className={link(current === "crashes")} aria-current={current === "crashes" ? "page" : undefined}>{t("crashes")}</Link>
      {canSeeAccounts && (
        <Link href="/admin/users" className={link(current === "accounts")} aria-current={current === "accounts" ? "page" : undefined}>{t("accounts")}</Link>
      )}
      <span className="flex-1" />
      <Link href="/account" className={link(false)}>{t("account")}</Link>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className={`${link(false)} cursor-pointer`}>{t("signOut")}</button>
      </form>
    </nav>
  );
}
