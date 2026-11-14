import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { run } from "@/lib/db/queries/run";
import { pendingSubmissions } from "@/lib/db/queries/submissions";
import { bsShort, fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";
import { parsePage } from "@/lib/stats/paginate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Submissions");
  return { title: t("metaTitle"), robots: { index: false } };
}

const PAGE_SIZE = 25;
const RESULTS = ["published", "waiting", "rejected", "changes_requested", "not_found", "closed", "not_permitted", "already_decided", "unsupported"] as const;
const FLAGS = ["anonymous", "needs_two_approvals", "possible_duplicate", "duplicate_link", "location_district_mismatch"] as const;

/**
 * Reports and additions waiting for a decision (SPEC 7.4). Reviewers and admins only, after the
 * code check; anyone else sees the ordinary not-found page. Never cached: it reads the session.
 */
export default function SubmissionsPage({ searchParams }: PageProps<"/[locale]/review/submissions">) {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Submissions searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Submissions({ searchParams }: { searchParams: PageProps<"/[locale]/review/submissions">["searchParams"] }) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  if (can(access.actor, "review_submissions").kind !== "allow") notFound();

  const [t, common, locale, { page: rawPage, result }] = await Promise.all([
    getTranslations("Submissions"), getTranslations("Common"), getLocale() as Promise<Locale>, searchParams,
  ]);
  const page = parsePage(rawPage);
  const rows = await run(pendingSubmissions, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const n = (v: number) => fmtNum(v, locale);
  const resultKey = RESULTS.find((r) => r === result);
  const sent = (d: string) => new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(new Date(d));

  return (
    <>
      <StaffNav current="submissions" canSeeAccounts={can(access.actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <h1 className="text-[32px] lg:text-[44px]">{t("heading")}</h1>
        <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("intro")}</p>
        {resultKey && (
          <p role="status" className="mt-4 border-2 border-ink bg-neutral-100 px-4 py-3 text-body font-semibold">{t(`result.${resultKey}`)}</p>
        )}

        {rows.length === 0 ? (
          <p className="mt-8 border-t-2 border-ink pt-6 text-body">{t("empty")}</p>
        ) : (
          <ul className="mt-6 border-t-2 border-ink">
            {rows.map((r) => {
              const place = [locale === "ne" ? r.placeNameNp ?? r.placeNameEn : r.placeNameEn ?? r.placeNameNp, locale === "ne" ? r.districtNp : r.districtEn].filter(Boolean).join(", ");
              return (
                <li key={r.id} className="border-b border-neutral-400">
                  <Link href={`/review/submissions/${r.id}`} className="block py-4 no-underline hover:bg-neutral-100">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="border border-ink px-2 py-0.5 text-meta font-extrabold">{t(`kind.${r.kind as "new_crash" | "add_source"}`)}</span>
                      <span className={`text-body font-extrabold ${r.deaths >= 3 ? "text-accent-700" : ""}`}>{common("killedCount", { count: n(r.deaths) })}</span>
                      <span className="text-body font-semibold">{bsShort(r.occurredOn, locale)} · {place}</span>
                    </div>
                    <p className="mt-1 text-meta text-neutral-700">
                      {t("sent", { date: sent(r.createdAt) })} · {t("approvals", { done: n(r.approvals), required: n(r.requiredApprovals) })}
                    </p>
                    {r.flags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-meta">
                        {r.flags.filter((f): f is (typeof FLAGS)[number] => (FLAGS as readonly string[]).includes(f)).map((f) => (
                          <span key={f} className="bg-neutral-300 px-2 py-0.5 font-semibold">{t(`flag.${f}`)}</span>
                        ))}
                      </p>
                    )}
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
              {page > 1 ? <Link href={`/review/submissions${page > 2 ? `?page=${page - 1}` : ""}`} className="btn btn-secondary h-11">{t("prev")}</Link> : null}
              <span aria-current="page" className="px-2">{t("page", { page: n(page), pages: n(pages) })}</span>
              {page < pages ? <Link href={`/review/submissions?page=${page + 1}`} className="btn btn-secondary h-11">{t("next")}</Link> : null}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
