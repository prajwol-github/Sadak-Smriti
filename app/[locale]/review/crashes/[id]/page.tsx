import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { AddLinkForm, CrashFactsForm, PersonForm, PublishForm, RemovePersonForm } from "@/components/review/edit-forms";
import { NeedsCode } from "@/components/review/needs-code";
import { StaffNav } from "@/components/review/staff-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { staffAccess } from "@/lib/auth/session";
import { crashForEdit, personsOfCrash, sourcesOfCrash } from "@/lib/db/queries/crash-edit";
import { listDistricts } from "@/lib/db/queries/places";
import { run } from "@/lib/db/queries/run";
import { fmtNum, type Locale } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { can } from "@/lib/policy/can";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Edit");
  return { title: t("metaEdit"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The staff crash editor (ADR 0008): facts, public or draft, sources, and people, each saved on
 * its own with a reason. `params` is read inside <Suspense>, and the header is wrapped too (the
 * project's pattern for dynamic routes). Staff only; never cached.
 */
export default function EditCrashPage({ params }: PageProps<"/[locale]/review/crashes/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="h-[68px] bg-ink" />}>
        <SiteNav />
      </Suspense>
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<div aria-busy="true" className="min-h-[60dvh]" />}>
          <Editor params={params} />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/[locale]/review/crashes/[id]">, "params">) {
  const access = await staffAccess();
  if (access.kind === "none") notFound();
  if (access.kind === "needs_code") return <NeedsCode />;
  const { actor } = access;
  if (can(actor, "edit_crash").kind !== "allow") notFound();

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [c] = await run(crashForEdit, { id });
  if (!c || c.status === "merged") notFound();

  const [t, locale, sources, people, districtRows] = await Promise.all([
    getTranslations("Edit"), getLocale() as Promise<Locale>,
    run(sourcesOfCrash, { crashId: id }), run(personsOfCrash, { crashId: id }), run(listDistricts, {}),
  ]);
  const ne = locale === "ne";
  const n = (v: number) => fmtNum(v, locale);
  const districts = districtRows.map((d) => ({ id: d.id, name: ne ? d.nameNp : d.nameEn })).sort((a, b) => a.name.localeCompare(b.name, ne ? "ne" : "en"));
  const isPublic = c.status === "published";
  const editable = c.status !== "rejected";
  const killedNamed = people.filter((p) => p.status === "killed").length;
  const mayRemove = can(actor, "delete").kind === "allow";
  const title = (ne ? c.titleNp ?? c.titleEn : c.titleEn ?? c.titleNp) ?? t("untitled");

  return (
    <>
      <StaffNav current="crashes" canSeeAccounts={can(actor, "view_accounts").kind === "allow"} />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link href="/review/crashes" className="text-small font-semibold">{t("back")}</Link>
        <h1 className="mt-3 text-[28px] lg:text-[40px]">{title}</h1>
        <p className="mt-1 text-small text-neutral-700">
          {t(`crashStatus.${c.status as "published"}`)} · {t("version", { n: n(c.version) })} · <Link href={`/review/crashes/${id}/history`} className="font-semibold">{t("history")}</Link>
        </p>

        {!editable ? <p role="status" className="mt-6 border-2 border-ink px-4 py-3 text-body font-semibold">{t("refused.closed")}</p> : (
          <>
            <section aria-labelledby="facts-h" className="mt-8">
              <h2 id="facts-h" className="text-h4">{t("factsHeading")}</h2>
              <CrashFactsForm
                districts={districts}
                crash={{
                  id, version: c.version, titleEn: c.titleEn ?? "", titleNp: c.titleNp ?? "", occurredOn: c.occurredOn.slice(0, 10), occurredTime: c.occurredTime?.slice(0, 5) ?? "",
                  placeNameEn: c.placeNameEn ?? "", placeNameNp: c.placeNameNp ?? "", districtId: c.districtId, deaths: c.deaths, injured: c.injured, vehicles: c.vehicles ?? [],
                }}
              />
            </section>

            <section aria-labelledby="pub-h" className="mt-10 border-t-2 border-ink pt-6">
              <h2 id="pub-h" className="text-h4">{t("publicationHeading")}</h2>
              <p className="mt-1 text-body font-semibold">{t(`crashStatus.${c.status as "published"}`)}</p>
              <p className="text-small text-neutral-700">{t("publishNote")}</p>
              <PublishForm crashId={id} version={c.version} isPublic={isPublic} />
            </section>

            <section aria-labelledby="src-h" className="mt-10 border-t-2 border-ink pt-6">
              <h2 id="src-h" className="text-h4">{t("sourcesHeading")}</h2>
              {sources.length === 0 ? <p className="mt-2 text-body">{t("noSources")}</p> : (
                <ul className="mt-2 border-t border-neutral-400">
                  {sources.map((s) => (
                    <li key={s.id} className="border-b border-neutral-400 py-2 text-body">
                      <span className="mr-2 bg-neutral-300 px-2 py-0.5 text-meta font-semibold">{t(`kind.${s.kind}`)} · {t(`relation.${s.relation}`)}</span>
                      {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold">{s.url} ↗</a> : null}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mt-6 text-ui font-extrabold">{t("addLinkHeading")}</h3>
              <AddLinkForm crashId={id} version={c.version} />
            </section>

            <section aria-labelledby="people-h" className="mt-10 border-t-2 border-ink pt-6">
              <h2 id="people-h" className="text-h4">{t("peopleHeading")}</h2>
              <p className="mt-1 text-small text-neutral-700">{t("peopleHint", { recorded: n(killedNamed), deaths: n(c.deaths) })}</p>
              {people.length === 0 && <p className="mt-2 text-body">{t("noPeople")}</p>}
              <ul className="mt-2">
                {people.map((p) => (
                  <li key={p.id} className="border-t border-neutral-400 py-4">
                    <p className="text-body font-extrabold">
                      {(ne ? p.nameNp ?? p.nameEn : p.nameEn ?? p.nameNp)} <span className="ml-1 bg-neutral-300 px-2 py-0.5 text-meta font-semibold">{t(`personStatus.${p.status}`)}</span>
                    </p>
                    <PersonForm
                      crashId={id} crashVersion={c.version}
                      person={{
                        id: p.id, version: p.version, status: p.status, nameEn: p.nameEn ?? "", nameNp: p.nameNp ?? "", age: p.age, sex: p.sex ?? "", roadUser: p.roadUser ?? "",
                        hometownText: p.hometownText ?? "", nameVisibility: p.nameVisibility, publication: p.publication,
                      }}
                    />
                    {mayRemove && <RemovePersonForm crashId={id} personId={p.id} version={p.version} />}
                  </li>
                ))}
              </ul>
              <h3 className="mt-6 border-t-2 border-ink pt-6 text-ui font-extrabold">{t("addPerson")}</h3>
              <PersonForm key={people.length} crashId={id} crashVersion={c.version} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
