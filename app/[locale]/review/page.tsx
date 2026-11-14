import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { newCandidates, outletHealth, recentRuns } from "@/lib/db/queries/pipeline";
import { run } from "@/lib/db/queries/run";
import { fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";
import { parsePage } from "@/lib/stats/paginate";
import { collectNow, decideNews } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Review");
  return { title: t("metaTitle"), robots: { index: false } };
}

const PAGE_SIZE = 20;

/**
 * The review area (SPEC 7.4; for now only the news queue from the worker, ADR 0007). Reviewers and
 * admins only, after the authenticator-app check; everyone else gets the ordinary not-found page.
 * Never cached: it reads the session.
 */
export default function ReviewPage({ searchParams }: PageProps<"/[locale]/review">) {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Review searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Review({ searchParams }: { searchParams: PageProps<"/[locale]/review">["searchParams"] }) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  const [t, locale] = await Promise.all([getTranslations("Review"), getLocale() as Promise<Locale>]);
  if (access.kind === "needs_code") return <NeedsCode />;
  if (can(access.actor, "review_news").kind !== "allow") notFound();

  const page = parsePage((await searchParams).page);
  const [items, runs, outlets] = await Promise.all([
    run(newCandidates, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    run(recentRuns, { limit: 8 }),
    run(outletHealth, {}),
  ]);
  const total = items[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const n = (v: number) => fmtNum(v, locale);
  const when = (d: Date | string | null) =>
    d ? new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(new Date(d)) : "";

  return (
    <>
    <StaffNav current="news" canSeeAccounts={can(access.actor, "view_accounts").kind === "allow"} />
    <div className="lg:grid lg:grid-cols-[1fr_340px]">
      <section aria-labelledby="news-h" className="min-w-0 px-4 py-8 lg:border-r-2 lg:border-ink lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 id="news-h" className="text-[32px] lg:text-[44px]">{t("heading")}</h1>
          <form action={collectNow}>
            <button type="submit" className="btn btn-secondary h-11">{t("runNow")}</button>
          </form>
        </div>
        <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("intro")}</p>

        {items.length === 0 ? (
          <p className="mt-8 border-t-2 border-ink pt-6 text-body">{t("empty")}</p>
        ) : (
          <ul className="mt-6 border-t-2 border-ink">
            {items.map((it) => (
              <li key={it.id} className="border-b border-neutral-400 py-4">
                <p className="text-meta text-neutral-700">{it.outlet} · {when(it.publishedAt ?? it.seenAt)}</p>
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-body font-semibold">{it.title} ↗</a>
                {it.summary && <p className="mt-1 line-clamp-3 text-small text-neutral-700">{it.summary}</p>}
                <p className="mt-1 text-meta text-neutral-700">{t("words", { words: it.matchedTerms.join(", ") })}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/submit" className="btn btn-primary h-10 min-h-10">{t("reportIt")} →</Link>
                  <form action={decideNews}>
                    <input type="hidden" name="id" value={it.id} />
                    <button type="submit" name="status" value="done" className="btn btn-secondary h-10 min-h-10">{t("done")}</button>
                  </form>
                  <form action={decideNews}>
                    <input type="hidden" name="id" value={it.id} />
                    <button type="submit" name="status" value="dismissed" className="btn btn-secondary h-10 min-h-10">{t("dismiss")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label={t("pager")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
            <p className="text-neutral-700">{t("count", { from: n((page - 1) * PAGE_SIZE + 1), to: n((page - 1) * PAGE_SIZE + items.length), total: n(total) })}</p>
            <div className="flex items-center gap-2">
              {page > 1 ? <Link href={`/review${page > 2 ? `?page=${page - 1}` : ""}`} className="btn btn-secondary h-11">{t("prev")}</Link> : null}
              <span aria-current="page" className="px-2">{t("page", { page: n(page), pages: n(pages) })}</span>
              {page < pages ? <Link href={`/review?page=${page + 1}`} className="btn btn-secondary h-11">{t("next")}</Link> : null}
            </div>
          </nav>
        )}
      </section>

      <aside className="border-t-2 border-ink px-4 py-8 lg:border-t-0 lg:px-6">
        <h2 className="text-h4">{t("runsHeading")}</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-small text-neutral-700">{t("noRuns")}</p>
        ) : (
          <ul className="mt-2">
            {runs.map((r) => (
              <li key={r.id} className="border-b border-neutral-400 py-2 text-small">
                <p className="font-semibold">{t(`status.${r.status}`)} · {t(`trigger.${r.trigger}`)}</p>
                <p className="text-neutral-700">{when(r.createdAt)}{r.status === "succeeded" ? ` · ${t("runLine", { new: n(r.itemsNew), candidates: n(r.candidatesNew) })}` : ""}</p>
                {r.error && <p className="text-accent-700">{r.error}</p>}
              </li>
            ))}
          </ul>
        )}
        <h2 className="mt-8 text-h4">{t("outletsHeading")}</h2>
        <ul className="mt-2">
          {outlets.map((o) => (
            <li key={o.slug} className="border-b border-neutral-400 py-2 text-small">
              <p className="font-semibold">{o.name}</p>
              <p className={o.consecutiveFailures > 0 ? "text-accent-700" : "text-neutral-700"}>
                {!o.enabled
                  ? t("outletDisabled")
                  : o.consecutiveFailures > 0
                    ? t("outletFailing", { count: n(o.consecutiveFailures), error: o.lastError ?? "" })
                    : o.lastOkAt ? t("outletOk", { when: when(o.lastOkAt) }) : t("outletNever")}
              </p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
    </>
  );
}
