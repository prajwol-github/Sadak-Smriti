import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CrashList, CrashListSkeleton } from "@/components/map/crash-list";
import { FullMap } from "@/components/map/full-map";

/**
 * The map page's content, shared by /map (page 1) and /map/page/N. The map and the crash list
 * are separate modules: the list has its own <Suspense> and skeleton, so a slow list query
 * never holds back the map or the headings. Each page's route renders the nav and footer.
 */
export async function MapBody({ page }: { page: Promise<number> }) {
  const t = await getTranslations("Map");
  return (
    <main id="content">
      <h1 className="sr-only">{t("heading")}</h1>
      <FullMap />
      <section id="list" aria-labelledby="list-h" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-10 lg:px-8">
        <h2 id="list-h" className="text-[28px] font-extrabold">{t("listHeading")}</h2>
        <Suspense fallback={<CrashListSkeleton />}>
          <CrashList page={page} />
        </Suspense>
        <p className="mt-6 text-meta text-neutral-700">{t("border")}</p>
        <p className="mt-1 text-meta text-neutral-700">{t("attribution")}</p>
      </section>
    </main>
  );
}
