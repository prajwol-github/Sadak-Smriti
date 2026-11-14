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
import { reviewsForSubmission, sourceForReview, submissionDetail } from "@/lib/db/queries/submissions";
import { similarCrashes } from "@/lib/db/queries/reports";
import { bsLong, fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can, canDecide } from "@/lib/policy/can";
import { REJECTION_REASONS } from "@/lib/workflow/decide";
import { decide } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Submissions");
  return { title: t("metaDetail"), robots: { index: false } };
}

const RESULTS = ["not_permitted", "already_decided", "unsupported", "closed"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Payload = {
  occurredOn?: string; occurredTime?: string | null; districtId?: string; placeName?: string | null; killed?: number; injured?: number | null;
  vehicles?: string[]; location?: { lat: number; lon: number } | null; sourceId?: string;
};

/**
 * The decision screen (SPEC 7.4): the report as sent, what it would change, the source, any
 * possible duplicates, the decisions so far, and the buttons. `params` is read inside <Suspense>
 * (the project's dynamic-route pattern). Staff only; never cached.
 */
export default function SubmissionPage({ params, searchParams }: PageProps<"/[locale]/review/submissions/[id]">) {
  return (
    <>
      {/* The header reads the URL, which needs <Suspense> on a route with a dynamic segment. */}
      <Suspense fallback={<div className="h-[68px] bg-ink" />}>
        <SiteNav />
      </Suspense>
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Decision params={params} searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Decision({ params, searchParams }: Pick<PageProps<"/[locale]/review/submissions/[id]">, "params" | "searchParams">) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  const { actor } = access;
  if (can(actor, "review_submissions").kind !== "allow") notFound();

  const [{ id }, { result }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [d] = await run(submissionDetail, { id });
  if (!d) notFound();

  const [t, common, vt, locale] = await Promise.all([
    getTranslations("Submissions"), getTranslations("Common"), getTranslations("Vehicle"), getLocale() as Promise<Locale>,
  ]);
  const payload = (d.payload ?? {}) as Payload;
  const [reviewList, source, similar] = await Promise.all([
    run(reviewsForSubmission, { submissionId: id }),
    payload.sourceId ? run(sourceForReview, { id: payload.sourceId }).then((r) => r[0]) : Promise.resolve(undefined),
    d.kind === "new_crash"
      ? run(similarCrashes, { districtId: d.districtId, from: shift(d.occurredOn, -2), to: shift(d.occurredOn, 2) }).then((r) => r.filter((c) => c.id !== d.crashId))
      : Promise.resolve([]),
  ]);

  const n = (v: number) => fmtNum(v, locale);
  const ne = locale === "ne";
  const placeOf = (en: string | null, np: string | null) => (ne ? np ?? en : en ?? np);
  const when = (iso: string, time: string | null | undefined) => `${bsLong(iso, locale)}${time ? ` · ${time.slice(0, 5)}` : ""}`;
  const sentAt = new Intl.DateTimeFormat(ne ? "ne-NP" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(new Date(d.createdAt));
  const approvedBy = reviewList.filter((r) => r.decision === "approve").map((r) => r.reviewerId);
  const mine = reviewList.some((r) => r.reviewerId === actor.id);
  const ownSubmission = d.submittedBy === actor.id;
  const mayDecide = d.status === "pending" && !mine && canDecide(actor, { submittedBy: d.submittedBy, approvedBy }).kind === "allow";
  const resultKey = RESULTS.find((r) => r === result);
  const isAddition = d.kind === "add_source";

  const reported = {
    killed: payload.killed, injured: payload.injured, occurredOn: payload.occurredOn, occurredTime: payload.occurredTime,
    placeName: payload.placeName, vehicles: payload.vehicles ?? [], location: payload.location,
  };
  const diff = (a: unknown, b: unknown) => isAddition && a !== undefined && a !== b;
  const changedHint = t("changedHint");

  return (
    <>
      <StaffNav current="submissions" canSeeAccounts={can(actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link href="/review/submissions" className="text-small font-semibold">{t("back")}</Link>
        <h1 className="mt-3 text-[28px] lg:text-[40px]">{t(`kind.${d.kind as "new_crash" | "add_source"}`)}</h1>
        <p className="mt-1 text-small text-neutral-700">
          {t("sent", { date: sentAt })} · {t("status")}: {t(`statusValue.${d.status as "pending"}`)} · {t("approvals", { done: n(approvedBy.length), required: n(d.requiredApprovals) })}
        </p>
        {d.flags.length > 0 && <p className="mt-1 text-small text-neutral-700">{d.flags.map((f) => (f in FLAG_KEYS ? t(`flag.${FLAG_KEYS[f]}`) : f)).join(" · ")}</p>}
        {resultKey && <p role="alert" className="mt-4 border-2 border-accent-700 bg-accent-100 px-4 py-3 text-body font-semibold">{t(`result.${resultKey}`)}</p>}

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="reported-h">
            <h2 id="reported-h" className="text-h4">{isAddition ? t("reported") : t("reported")}</h2>
            <dl className="mt-2 border-t-2 border-ink">
              <Row hint={changedHint} label={t("when")} changed={diff(reported.occurredOn, d.occurredOn)}>{when(reported.occurredOn ?? d.occurredOn, reported.occurredTime ?? null)}</Row>
              <Row hint={changedHint} label={t("where")}>{[reported.placeName ?? placeOf(d.placeNameEn, d.placeNameNp), ne ? d.districtNp : d.districtEn, ne ? d.provinceNp : d.provinceEn].filter(Boolean).join(", ")}</Row>
              <Row hint={changedHint} label={t("killed")} changed={diff(reported.killed, d.deaths)}>{common("killedCount", { count: n(reported.killed ?? d.deaths) })}</Row>
              <Row hint={changedHint} label={t("injured")} changed={diff(reported.injured ?? null, d.injured)}>{reported.injured == null ? t("notGiven") : n(reported.injured)}</Row>
              <Row hint={changedHint} label={t("vehicles")}>{reported.vehicles.length ? reported.vehicles.map((v) => vt(v as "bus")).join(", ") : t("notGiven")}</Row>
              <Row hint={changedHint} label={t("location")}>{reported.location ? `${reported.location.lat.toFixed(5)}, ${reported.location.lon.toFixed(5)}` : t("noPin")}</Row>
              <Row hint={changedHint} label={t("source")}>
                {source?.kind === "news" && source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold">{t("newsLink")} <span className="block text-small font-normal text-neutral-700">{source.url}</span></a>
                ) : source?.textPrivate ? (
                  <>
                    <span className="block text-small text-neutral-700">{t("witness")}</span>
                    <span className="mt-1 block whitespace-pre-wrap">{source.textPrivate}</span>
                  </>
                ) : t("notGiven")}
              </Row>
            </dl>
            {d.hasContact && <p className="mt-2 text-small text-neutral-700">{t("hasContact")}</p>}
          </section>

          <section aria-labelledby="current-h">
            <h2 id="current-h" className="text-h4">{isAddition ? t("currentRecord") : t("duplicates")}</h2>
            {isAddition ? (
              <dl className="mt-2 border-t-2 border-ink">
                <Row hint={changedHint} label={t("status")}>{t(`crashStatus.${d.crashStatus as "published"}`)}</Row>
                <Row hint={changedHint} label={t("when")}>{when(d.occurredOn, d.occurredTime)}</Row>
                <Row hint={changedHint} label={t("killed")}>{common("killedCount", { count: n(d.deaths) })}</Row>
                <Row hint={changedHint} label={t("injured")}>{d.injured == null ? t("notGiven") : n(d.injured)}</Row>
                <Row hint={changedHint} label={t("source")}>{n(d.sourceCount)}</Row>
              </dl>
            ) : similar.length === 0 ? (
              <p className="mt-2 border-t-2 border-ink pt-3 text-body">{t("duplicatesNone")}</p>
            ) : (
              <ul className="mt-2 border-t-2 border-ink">
                {similar.map((c) => (
                  <li key={c.id} className="border-b border-neutral-400 py-2 text-body">
                    <span className="font-semibold">{bsLong(c.occurredOn, locale)}</span> · {placeOf(c.placeNameEn, c.placeNameNp) ?? "—"} · {common("killedCount", { count: n(c.deaths) })}
                    <span className="ml-2 bg-neutral-300 px-2 py-0.5 text-meta font-semibold">{c.status === "published" ? t("duplicatePublic") : t("duplicateDraft")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="reviews-h" className="mt-8">
          <h2 id="reviews-h" className="text-h4">{t("reviewsHeading")}</h2>
          {reviewList.length === 0 ? <p className="mt-2 text-body">{t("noReviews")}</p> : (
            <ul className="mt-2 border-t-2 border-ink">
              {reviewList.map((r) => (
                <li key={r.id} className="border-b border-neutral-400 py-2 text-body">
                  <span className="font-semibold">{r.reviewerName}</span> · {t(`decision.${r.decision as "approve"}`)}
                  {r.reasonCode && <> · {t(`reason.${r.reasonCode as "duplicate"}`)}</>}
                  {r.note && <p className="text-small text-neutral-700">{r.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="decide-h" className="mt-8 border-t-2 border-ink pt-6">
          <h2 id="decide-h" className="sr-only">{t("approve")}</h2>
          {d.status !== "pending" ? (
            <p className="text-body font-semibold">{t("closedNote")}</p>
          ) : !mayDecide ? (
            <p className="text-body font-semibold">{mine ? t("alreadyDecided") : ownSubmission ? t("cannotOwn") : t("result.not_permitted")}</p>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              <form action={decide}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="locale" value={locale} />
                <p className="text-small text-neutral-700">{isAddition ? t("approveHintAddition") : t("approveHint")}</p>
                <button type="submit" name="decision" value="approve" className="btn btn-primary mt-3 h-12 text-body">{t("approve")} →</button>
              </form>
              <form action={decide}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="locale" value={locale} />
                <label className="block">
                  <span className="block text-small font-semibold">{t("rejectReason")}</span>
                  <select name="reason" required defaultValue="" className="mt-1.5 h-12 w-full border border-neutral-500 bg-neutral-100 px-3 text-body">
                    <option value="" disabled />
                    {REJECTION_REASONS.map((r) => <option key={r} value={r}>{t(`reason.${r}`)}</option>)}
                  </select>
                </label>
                <label className="mt-3 block">
                  <span className="block text-small font-semibold">{t("note")}</span>
                  <textarea name="note" rows={2} maxLength={1000} className="mt-1.5 w-full border border-neutral-500 bg-neutral-100 px-3 py-2 text-body" />
                </label>
                <button type="submit" name="decision" value="reject" className="btn btn-secondary mt-3 h-11">{t("reject")}</button>
              </form>
              <form action={decide}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="locale" value={locale} />
                <label className="block">
                  <span className="block text-small font-semibold">{t("changesNote")}</span>
                  <textarea name="note" rows={3} required maxLength={1000} className="mt-1.5 w-full border border-neutral-500 bg-neutral-100 px-3 py-2 text-body" />
                </label>
                <button type="submit" name="decision" value="request_changes" className="btn btn-secondary mt-3 h-11">{t("requestChanges")}</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ label, children, changed = false, hint }: { label: string; children: React.ReactNode; changed?: boolean; hint: string }) {
  return (
    <div className={`grid grid-cols-[8rem_1fr] gap-3 border-b border-neutral-400 py-2 ${changed ? "bg-accent-100" : ""}`}>
      <dt className="label text-neutral-700">{label}{changed && <span className="sr-only"> — {hint}</span>}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

const FLAG_KEYS: Record<string, "anonymous" | "needs_two_approvals" | "possible_duplicate" | "duplicate_link" | "location_district_mismatch"> = {
  anonymous: "anonymous", needs_two_approvals: "needs_two_approvals", possible_duplicate: "possible_duplicate",
  duplicate_link: "duplicate_link", location_district_mismatch: "location_district_mismatch",
};

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
