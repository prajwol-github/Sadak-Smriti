import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapBody } from "@/components/map/map-body";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Map");
  return { title: t("metaTitle") };
}

/**
 * Full map (design handoff screen 2), page 1 of the crash list. Sample data until the database
 * exists (PLAN P1-09). Later list pages are /map/page/N (app/[locale]/map/page/[page]).
 */
export default function MapPage() {
  return (
    <>
      <SiteNav current="map" />
      <MapBody page={Promise.resolve(1)} />
      <SiteFooter />
    </>
  );
}
