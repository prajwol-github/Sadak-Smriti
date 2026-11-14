import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { HomeHero, LatestMobile } from "@/components/home/hero";
import { CallsToAction, InTheNews, PoliceStatistics, RememberedToday, ThisWeek } from "@/components/home/sections";

/** Home (design handoff screen 1). Sample data until the database exists (PLAN P1-08). */
export default async function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="content">
        <HomeHero />
        <LatestMobile />
        <RememberedToday />
        <ThisWeek />
        <InTheNews />
        <PoliceStatistics />
        <CallsToAction />
      </main>
      <SiteFooter />
    </>
  );
}
