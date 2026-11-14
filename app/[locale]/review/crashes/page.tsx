import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { staffCrashList } from "@/lib/db/queries/crash-edit";
import { run } from "@/lib/db/queries/run";
import { bsShort, fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";
import { parsePage } from "@/lib/stats/paginate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Edit");
  return { title: t("listMeta"), robots: { index: false } };
}

const PAGE_SIZE = 25;
const FILTERS = ["all", "published", "draft", "rejected"] as const;

/**
 * Every crash for staff to open and edit (ADR 0008). Reviewers and admins only, after the code
 * check; anyone else sees the ordinary not-found page. Never cached: it reads the session.
 */
export default function CrashesPage({ searchParams }: PageProps<"/[locale]/review/crashes">) {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Crashes searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Crashes({ searchParams }: { searchParams: PageProps<"/[locale]/review/crashes">["searchParams"] }) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  if (can(access.actor, "edit_crash").kind !== "allow") notFound();

  const [t, common, locale, { page: rawPage, status }] = await Promise.all([
    getTranslations("Edit"), getTranslations("Common"), getLocale() as Promise<Locale>, searchParams,
  ]);
  const filter = FILTERS.find((f) => f === status) ?? "all";
  const page = parsePage(rawPage);
  const rows = await run(staffCrashList, { status: filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const n = (v: number) => fmtNum(v, locale);
  const ne = locale === "ne";
  const href = (p: number) => `/review/crashes?${filter !== "all" ? `status=${filter}&` : ""}${p > 1 ? `page=${p}` : ""}`.replace(/[?&]$/, "");

  return (
    <>
      <StaffNav current="crashes" canSeeAccounts={can(access.actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-[32px] lg:text-[44px]">{t("listHeading")}</h1>
          {can(access.actor, "create_crash").kind === "allow" && (
            <Link href="/review/crashes/new" className="btn btn-primary h-11 text-ui">
              {t("createCrash")} +
            </Link>
          )}
        </div>
        <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("listIntro")}</p>

        <nav aria-label={t("filterLabel")} className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link key={f} href={f === "all" ? "/review/crashes" : `/review/crashes?status=${f}`} aria-current={f === filter ? "page" : undefined}
              className={`flex min-h-11 items-center border-2 border-ink px-3.5 text-ui font-semibold no-underline ${f === filter ? "bg-ink text-bg" : ""}`}>
              {t(`filter.${f}`)}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="mt-8 border-t-2 border-ink pt-6 text-body">{t("empty")}</p>
        ) : (
          <ul className="mt-6 border-t-2 border-ink">
            {rows.map((c) => {
              const title = (ne ? c.titleNp ?? c.titleEn : c.titleEn ?? c.titleNp) ?? t("untitled");
              const place = [ne ? c.placeNameNp ?? c.placeNameEn : c.placeNameEn ?? c.placeNameNp, ne ? c.districtNp : c.districtEn].filter(Boolean).join(", ");
              return (
                <li key={c.id} className="border-b border-neutral-400">
                  <Link href={`/review/crashes/${c.id}`} className="block py-4 no-underline hover:bg-neutral-100">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`border px-2 py-0.5 text-meta font-extrabold ${c.status === "published" ? "border-ink" : "border-neutral-500 text-neutral-700"}`}>{t(`crashStatus.${c.status as "published"}`)}</span>
                      <span className={`text-body font-extrabold ${c.deaths >= 3 ? "text-accent-700" : ""}`}>{common("killedCount", { count: n(c.deaths) })}</span>
                      <span className="text-body font-semibold">{title}</span>
                    </div>
                    <p className="mt-1 text-meta text-neutral-700">{bsShort(c.occurredOn, locale)} · {place} · {t("peopleCount", { count: n(c.persons) })}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label={t("pager")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
            <p className="text-neutral-700">{t("count", { from: n((page - 1) * PAGE_SIZE + 1), to: n((page - 1) * PAGE_SIZE + rows.length), total: n(total) })}</p>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={href(page - 1)} className="btn btn-secondary h-11">{t("prev")}</Link> : null}
              <span aria-current="page" className="px-2">{t("page", { page: n(page), pages: n(pages) })}</span>
              {page < pages ? <Link href={href(page + 1)} className="btn btn-secondary h-11">{t("next")}</Link> : null}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
