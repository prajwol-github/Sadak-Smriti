import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ReportForm } from "@/components/report/report-form";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { listDistricts } from "@/lib/db/queries/places";
import { run } from "@/lib/db/queries/run";
import { BS_MONTHS, adToBs, todayInNepal } from "@/lib/domain/bs-date";
import type { Locale } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Report");
  return { title: t("metaTitle") };
}

/**
 * Report a crash (docs/plans/report-a-crash.md; SPEC 7.1; ADR 0004). No login needed.
 * The form reads the districts at request time, inside <Suspense>, so builds never need a
 * database and the header and footer stay in the static shell.
 */
export default function SubmitPage() {
  return (
    <>
      <SiteNav />
      <main id="content" className="border-b-2 border-ink">
        <Suspense fallback={<FormFallback />}>
          <Form />
        </Suspense>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}

async function Form() {
  await connection(); // per request: today's date and live district data
  const locale = (await getLocale()) as Locale;
  const rows = await run(listDistricts, {});
  const districts = rows
    .map((d) => ({ id: d.id, name: locale === "ne" ? d.nameNp : d.nameEn }))
    .sort((a, b) => a.name.localeCompare(b.name, locale === "ne" ? "ne" : "en"));
  const ad = todayInNepal();
  const bs = adToBs(ad);
  return (
    <ReportForm
      districts={districts}
      months={BS_MONTHS[locale]}
      today={{ ad, bsYear: bs.year, bsMonth: bs.month, bsDay: bs.day }}
      siteKey={process.env.TURNSTILE_SITE_KEY ?? ""}
      locale={locale}
    />
  );
}

async function FormFallback() {
  const t = await getTranslations("Common");
  return (
    <div role="status" aria-busy="true" className="min-h-[70dvh] px-4 py-8 lg:px-8">
      <p className="sr-only">{t("loading")}</p>
    </div>
  );
}
