import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapBody } from "@/components/map/map-body";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { listCrashes } from "@/lib/stats/crashes";
import { parsePage } from "@/lib/stats/paginate";

/**
 * Pages 2 and up are their own static routes, built ahead of time, so a list page is a file
 * served from cache like the map itself, with no request-time work (a `?page=` query would make
 * the whole page dynamic and re-send the page's data with every request). When a crash is added,
 * the "crashes" tag is purged and these are rebuilt.
 */
export async function generateStaticParams() {
  const { pageCount } = await listCrashes(1);
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => ({ page: String(i + 2) }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Map");
  return { title: t("metaTitle") };
}

/** A later page of the crash list under the map. A page past the end shows the last page. */
export default function MapListPage({ params }: PageProps<"/[locale]/map/page/[page]">) {
  return (
    <>
      <SiteNav current="map" />
      <MapBody page={params.then((p) => parsePage(p.page))} />
      <SiteFooter />
    </>
  );
}
