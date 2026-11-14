import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";

const intl = createMiddleware(routing);

/** True when the path already starts with a supported locale, e.g. /ne or /en/map. */
export function hasLocalePrefix(pathname: string): boolean {
  return routing.locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
}

/**
 * Picks the language for a request without one in its path.
 *
 * SPEC 6.1: Nepali is the default for visitors from Nepal. Many phones in Nepal are set to
 * English, so Accept-Language alone would send them to /en. Cloudflare's CF-IPCountry header
 * (trusted because the server only accepts traffic from Cloudflare, SPEC 12.2) decides first;
 * a language the visitor chose before (the NEXT_LOCALE cookie) always wins.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const chosen = request.cookies.get("NEXT_LOCALE")?.value;
  if (!hasLocalePrefix(pathname) && !chosen && request.headers.get("cf-ipcountry") === "NP") {
    const url = request.nextUrl.clone();
    url.pathname = `/ne${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }
  return intl(request);
}

export const config = {
  // Everything except Next internals, API routes and files with an extension (tiles, map data, fonts).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
