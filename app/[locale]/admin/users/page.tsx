import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { roleOf } from "@/lib/auth/actor";
import { staffAccess } from "@/lib/auth/session";
import { run } from "@/lib/db/queries/run";
import { listAccounts } from "@/lib/db/queries/users";
import { fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can, canChangeRole, canDeactivate } from "@/lib/policy/can";
import { parsePage } from "@/lib/stats/paginate";
import { changeRole, setStatus } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Accounts");
  return { title: t("metaTitle"), robots: { index: false } };
}

const PAGE_SIZE = 25;

/**
 * Everyone who has signed in, with their role (ADR 0006). Reviewers and admins see it; only an
 * admin changes roles; reviewers and admins deactivate within the limits in lib/policy/can.ts.
 * Anyone else gets the ordinary not-found page. Never cached: it reads the session.
 */
export default function AccountsPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Accounts searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Accounts({ searchParams }: { searchParams: PageProps<"/[locale]/admin/users">["searchParams"] }) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  const { actor } = access;
  if (can(actor, "view_accounts").kind !== "allow") notFound();

  const [t, auth, locale, { page: rawPage }] = await Promise.all([
    getTranslations("Accounts"), getTranslations("Auth"), getLocale() as Promise<Locale>, searchParams,
  ]);
  const page = parsePage(rawPage);
  const rows = await run(listAccounts, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const n = (v: number) => fmtNum(v, locale);
  const date = (d: Date | string) =>
    new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(new Date(d));

  return (
    <>
      <StaffNav current="accounts" canSeeAccounts />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <h1 className="text-[32px] lg:text-[44px]">{t("heading")}</h1>
        <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("intro")}</p>
        <p className="mt-1 max-w-[72ch] text-small text-neutral-700">{t("roleChanged")}</p>

        <ul className="mt-6 border-t-2 border-ink">
          {rows.map((u) => {
            const role = roleOf(u.role);
            const me = u.id === actor.id;
            const target = { id: u.id, role };
            const otherRole = role === "reviewer" ? "contributor" : "reviewer";
            const mayChangeRole = canChangeRole(actor, target, otherRole).kind === "allow";
            const mayDeactivate = canDeactivate(actor, target).kind === "allow";
            const staff = role === "reviewer" || role === "admin";
            return (
              <li key={u.id} className="border-b border-neutral-400 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-body font-semibold">{u.name}</p>
                  {me && <span className="bg-ink px-2 py-0.5 text-meta font-extrabold text-bg">{t("you")}</span>}
                  <span className="border border-ink px-2 py-0.5 text-meta font-extrabold">{auth(`role.${role}`)}</span>
                  <span className={`px-2 py-0.5 text-meta font-extrabold ${u.bannedAt ? "bg-accent-100 text-accent-700" : "bg-neutral-300"}`}>
                    {u.bannedAt ? t("deactivated") : t("active")}
                  </span>
                </div>
                <p className="break-all text-small text-neutral-700">{u.email}</p>
                <p className="mt-1 text-meta text-neutral-700">
                  {t("joined", { date: date(u.createdAt) })} · {u.lastSeen ? t("lastActive", { date: date(u.lastSeen) }) : t("noRecentActivity")}
                  {staff && ` · ${u.twoFactorEnabled ? t("authenticatorOn") : t("authenticatorOff")}`}
                </p>
                {u.bannedAt && (
                  <p className="mt-1 text-small text-accent-700">{t("deactivatedNote", { date: date(u.bannedAt), reason: u.banReason || t("noReason") })}</p>
                )}
                {role === "admin" && !me && <p className="mt-1 text-meta text-neutral-700">{t("adminNote")}</p>}

                {(mayChangeRole || mayDeactivate) && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    {mayChangeRole && (
                      <form action={changeRole}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" name="role" value={otherRole} className="btn btn-secondary h-10 min-h-10">
                          {otherRole === "reviewer" ? t("makeReviewer") : t("makeContributor")}
                        </button>
                      </form>
                    )}
                    {mayDeactivate && u.bannedAt && (
                      <form action={setStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" name="ban" value="false" className="btn btn-secondary h-10 min-h-10">{t("reactivate")}</button>
                      </form>
                    )}
                    {mayDeactivate && !u.bannedAt && (
                      <form action={setStatus} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <label className="block">
                          <span className="block text-meta font-semibold">{t("reasonLabel")}</span>
                          <input name="reason" maxLength={200} className="mt-1 h-10 w-64 max-w-full border border-neutral-500 bg-neutral-100 px-3 text-ui" />
                        </label>
                        <button type="submit" name="ban" value="true" className="btn btn-secondary h-10 min-h-10">{t("deactivate")}</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {pages > 1 && (
          <nav aria-label={t("pager")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
            <p className="text-neutral-700">{t("count", { from: n((page - 1) * PAGE_SIZE + 1), to: n((page - 1) * PAGE_SIZE + rows.length), total: n(total) })}</p>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={`/admin/users${page > 2 ? `?page=${page - 1}` : ""}`} className="btn btn-secondary h-11">{t("prev")}</Link> : null}
              <span aria-current="page" className="px-2">{t("page", { page: n(page), pages: n(pages) })}</span>
              {page < pages ? <Link href={`/admin/users?page=${page + 1}`} className="btn btn-secondary h-11">{t("next")}</Link> : null}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
