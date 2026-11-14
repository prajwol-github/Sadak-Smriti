import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { historyOfCrash } from "@/lib/db/queries/crash-edit";
import { run } from "@/lib/db/queries/run";
import { fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";
import { restoreForm } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Edit");
  return { title: t("historyHeading"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_CODES = ["belowPeople", "tooManyKilled", "killedNeedsNewsSource"] as const;
/** Fields that are bookkeeping, not something a person changed. */
const HIDDEN_KEYS = new Set(["crashId", "slug"]);

/**
 * The history of a crash and its people, newest first, with who changed what and why, and a
 * one-click restore (ADR 0008). Restoring adds a new version; nothing is erased.
 */
export default function HistoryPage({ params, searchParams }: PageProps<"/[locale]/review/crashes/[id]/history">) {
  return (
    <>
      <Suspense fallback={<div className="h-[68px] bg-ink" />}>
        <SiteNav />
      </Suspense>
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <History params={params} searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function History({ params, searchParams }: Pick<PageProps<"/[locale]/review/crashes/[id]/history">, "params" | "searchParams">) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  const { actor } = access;
  if (can(actor, "edit_crash").kind !== "allow") notFound();

  const [{ id }, { result }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, locale, rows] = await Promise.all([getTranslations("Edit"), getLocale() as Promise<Locale>, run(historyOfCrash, { crashId: id, limit: 100 })]);
  const ne = locale === "ne";
  const when = (d: string) => new Intl.DateTimeFormat(ne ? "ne-NP" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(new Date(d));

  // Rows are newest first, so the same record's previous version is the next one down the list.
  const previous = (i: number) => rows.slice(i + 1).find((r) => r.entityId === rows[i].entityId);
  const labelOf = (key: string) => t(`field.${key}` as never);
  const banner =
    result === "restored" ? { text: t("restoredBanner"), ok: true }
    : result === "conflict" ? { text: t("conflict"), ok: false }
    : result === "refused" ? { text: t("refused.not_permitted"), ok: false }
    : ERROR_CODES.find((c) => c === result) ? { text: t(`error.${result as (typeof ERROR_CODES)[number]}`), ok: false }
    : null;

  return (
    <>
      <StaffNav current="crashes" canSeeAccounts={can(actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link href={`/review/crashes/${id}`} className="text-small font-semibold">{t("backToCrash")}</Link>
        <h1 className="mt-3 text-[32px] lg:text-[44px]">{t("historyHeading")}</h1>
        <p className="mt-2 max-w-[72ch] text-body text-neutral-700">{t("historyIntro")}</p>
        {banner && <p role={banner.ok ? "status" : "alert"} className={`mt-4 border-2 px-4 py-3 text-body font-semibold ${banner.ok ? "border-ink bg-neutral-100" : "border-accent-700 bg-accent-100"}`}>{banner.text}</p>}

        {rows.length === 0 ? <p className="mt-8 border-t-2 border-ink pt-6 text-body">{t("historyEmpty")}</p> : (
          <ul className="mt-6 border-t-2 border-ink">
            {rows.map((r, i) => {
              const prev = previous(i);
              const data = r.data as Record<string, unknown>;
              const removed = data.deleted === true;
              const changed = removed ? ["deleted"] : prev ? Object.keys(data).filter((k) => !HIDDEN_KEYS.has(k) && JSON.stringify(data[k] ?? null) !== JSON.stringify((prev.data as Record<string, unknown>)[k] ?? null)) : [];
              const who = r.actorName ?? t("system");
              const name = r.entityType === "person" ? (ne ? (data.nameNp as string | null) ?? (data.nameEn as string | null) : (data.nameEn as string | null) ?? (data.nameNp as string | null)) : null;
              return (
                <li key={r.id} className="border-b border-neutral-400 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="border border-ink px-2 py-0.5 text-meta font-extrabold">{r.entityType === "crash" ? t("crashEntity") : t("personEntity")}</span>
                    {name && <span className="text-body font-semibold">{name}{removed ? ` ${t("removedPerson")}` : ""}</span>}
                    <span className="text-small text-neutral-700">{t("version", { n: fmtNum(r.version, locale) })} · {when(r.createdAt)} · {t("by", { name: who })}</span>
                  </div>
                  <p className="mt-1 text-body">{r.reason ?? <span className="text-neutral-700">{t("noReason")}</span>}</p>
                  <p className="mt-1 text-small text-neutral-700">{prev || removed ? (changed.length ? t("changed", { fields: changed.map(labelOf).join(", ") }) : "") : t("firstVersion")}</p>
                  {!removed && (
                    <form action={restoreForm} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="crashId" value={id} />
                      <input type="hidden" name="revisionId" value={r.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <label className="block">
                        <span className="block text-meta font-semibold">{t("restoreReason")}</span>
                        <input name="reason" required minLength={3} maxLength={300} className="mt-1 h-10 w-64 max-w-full border border-neutral-500 bg-neutral-100 px-3 text-ui" />
                      </label>
                      <button type="submit" className="btn btn-secondary h-10 min-h-10">{t("restore")}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
