/**
 * One spelling per feed entry, for `feed_items.normalized_url` only. NOT the format of
 * `sources.normalized_url` (`host/path`, no scheme: lib/forms/report.ts `normalizeUrl`). When a feed item
 * becomes a source on a crash (PLAN P2-06), convert it with that function so the same article is never
 * stored twice.
 *
 * One spelling per article, so the same story seen twice (with tracking tags, a trailing slash,
 * a #fragment, a different case in the host) is stored once (SPEC 7.2 step 2).
 */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|amp)$/i;

export function normalizeUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.port = "";
  u.hash = "";
  u.username = "";
  u.password = "";
  const kept = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}
