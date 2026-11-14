import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { bsShort, fmtNum, type Locale } from "@/lib/format";
import { CRASH_PAGE_SIZE, listCrashes } from "@/lib/stats/crashes";

/** Page 1 is the map's own address; later pages are /map/page/N (static routes, see app/[locale]/map/page). */
function pageHref(page: number) {
  return `/map${page > 1 ? `/page/${page}` : ""}#list`;
}

/**
 * One page of the crash list. `page` is a promise so a route can pass its `params` down unread
 * and keep the rest of the page in the static shell. The pager is plain links (no JavaScript),
 * so it works with tiles blocked and on slow phones.
 */
export async function CrashList({ page }: { page: Promise<number> }) {
  const requested = await page;
  const [t, common, locale, list] = await Promise.all([
    getTranslations("Map"),
    getTranslations("Common"),
    getLocale() as Promise<Locale>,
    listCrashes(requested),
  ]);
  const n = (v: number) => fmtNum(v, locale);
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = (list.page - 1) * list.pageSize + list.rows.length;

  return (
    <>
      <ul className="mt-4 border-t-2 border-ink">
        {list.rows.map((c) => (
          <li key={c.slug} className="flex flex-wrap items-baseline gap-x-4 border-b border-neutral-400 py-3">
            <span className="w-24 text-small text-neutral-700">{bsShort(c.date, locale)}</span>
            <Link href={`/crash/${c.slug}`} className="flex-1 font-semibold">{c.title[locale]}</Link>
            <span className="text-small font-extrabold text-accent-700">{common("killedCount", { count: n(c.killed) })}</span>
          </li>
        ))}
      </ul>
      {list.pageCount > 1 && (
        <nav aria-label={t("listPager")} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
          <p className="text-neutral-700">{t("listCount", { from: n(first), to: n(last), total: n(list.total) })}</p>
          <div className="flex items-center gap-2">
            <PagerLink href={list.page > 1 ? pageHref(list.page - 1) : null} label={t("listPrev")} />
            <span aria-current="page" className="px-2 tabular">{t("listPage", { page: n(list.page), pages: n(list.pageCount) })}</span>
            <PagerLink href={list.page < list.pageCount ? pageHref(list.page + 1) : null} label={t("listNext")} />
          </div>
        </nav>
      )}
    </>
  );
}

function PagerLink({ href, label }: { href: string | null; label: string }) {
  const box = "inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink px-4 font-extrabold";
  if (!href) return <span aria-disabled className={`${box} cursor-not-allowed opacity-40`}>{label}</span>;
  return <Link href={href} className={`${box} hover:bg-ink hover:text-bg`}>{label}</Link>;
}

/** Same shape as one page of the list, so nothing jumps when it arrives. */
export function CrashListSkeleton() {
  return (
    <ul aria-busy="true" className="mt-4 border-t-2 border-ink">
      {Array.from({ length: CRASH_PAGE_SIZE }, (_, i) => (
        <li key={i} className="flex items-baseline gap-x-4 border-b border-neutral-400 py-3">
          <span className="h-4 w-24 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
          <span className="h-4 flex-1 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
          <span className="h-4 w-16 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
