import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { LanguageSwitch } from "./language-switch";
import { CloseIcon, MenuIcon, SearchIcon } from "./icons";

export type NavKey = "map" | "remember" | "data" | "contribute" | null;

const LINKS: { key: Exclude<NavKey, null>; href: string }[] = [
  { key: "map", href: "/map" },
  { key: "remember", href: "/remember" },
  { key: "data", href: "/data" },
  { key: "contribute", href: "/contribute" },
];

/**
 * The one site header, identical on every page (owner's decision, 13 Nov 2026; it replaced the
 * handoff's separate light header for inner pages). Only `current` changes: the link of the
 * section you're in is underlined.
 * - Desktop: 68px ink bar: brand, links, search, language, light "Report a crash" button.
 * - Phone: 56px ink bar with a menu (plain <details>, works without JavaScript).
 */
export async function SiteNav({ current = null }: { current?: NavKey }) {
  const t = await getTranslations("Nav");
  const site = await getTranslations("Site");

  return (
    // relative z-40: the phone menu opens over full-screen maps and other positioned content.
    <header className="relative z-40 border-b border-neutral-800 bg-ink text-bg">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-bg focus:px-4 focus:py-2 focus:text-ink">
        {site("skipToContent")}
      </a>

      {/* Desktop */}
      <div className="hidden h-[68px] items-center gap-8 px-8 lg:flex">
        <Link href="/" className="flex items-baseline gap-2.5 no-underline hover:text-inherit active:opacity-75">
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">{site("name")}</span>
          <span className="text-ui text-neutral-500">{site("nameOther")}</span>
        </Link>
        <span className="flex-1" />
        <nav aria-label={t("label")}>
          <ul className="flex gap-6 text-ui font-semibold">
            {LINKS.map(({ key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={current === key ? "page" : undefined}
                  className="flex min-h-11 items-center no-underline transition-opacity active:opacity-60 aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[6px]"
                >
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/search" aria-label={t("search")} className="flex size-10 items-center justify-center border border-neutral-700 no-underline transition-colors active:bg-neutral-800">
          <SearchIcon />
        </Link>
        <LanguageSwitch />
        <Link href="/submit" className="btn btn-light h-10 min-h-10 active:opacity-85">
          {t("reportCrash")}
        </Link>
      </div>

      {/* Phone */}
      <div className="flex h-14 items-center gap-3 px-4 lg:hidden">
        <Link href="/" className="text-[18px] font-extrabold no-underline hover:text-inherit active:opacity-75">
          {site("name")}
        </Link>
        <span className="flex-1" />
        <details className="group relative">
          <summary
            aria-label={t("menu")}
            className="flex size-11 cursor-pointer list-none items-center justify-center border border-neutral-700 active:bg-neutral-800 [&::-webkit-details-marker]:hidden"
          >
            <span className="group-open:hidden"><MenuIcon size={20} /></span>
            <span className="hidden group-open:inline"><CloseIcon size={20} /></span>
          </summary>
          <div className="absolute right-0 top-[52px] z-40 w-64 border-2 border-ink bg-bg text-ink shadow-lg">
            <nav aria-label={t("label")}>
              <ul>
                {LINKS.map(({ key, href }) => (
                  <li key={key} className="border-b border-neutral-400">
                    <Link href={href} aria-current={current === key ? "page" : undefined} className="flex min-h-12 items-center px-4 font-semibold no-underline transition-colors active:bg-neutral-200 aria-[current=page]:underline aria-[current=page]:decoration-2">
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center justify-between gap-2 px-4 py-2">
              <LanguageSwitch />
            </div>
            <div className="p-3 pt-0">
              <Link href="/submit" className="btn btn-primary w-full">{t("reportCrash")}</Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
