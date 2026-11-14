import { XMLParser } from "fast-xml-parser";

/**
 * Reading outlets' feeds (SPEC 7.2 step 1): RSS 2.0 and Atom, from the outlets in
 * content/outlets.json. Article pages are not fetched yet (that is PLAN P2-03, which also adds the
 * private-address checks needed for URLs that users supply).
 */

export interface FeedItem {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => ["item", "entry", "link"].includes(name),
});

type Node = Record<string, unknown>;
const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in (v as Node)) return String((v as Node)["#text"]);
  return "";
};
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
/** Entities survive inside CDATA, where the XML parser leaves them alone. */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
/** Feed titles and summaries are often HTML; keep plain text, short. */
const plain = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 600);
const date = (s: string): Date | null => {
  const d = new Date(s);
  return s && !Number.isNaN(d.getTime()) ? d : null;
};

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Node;
  const rss = (doc.rss as Node | undefined)?.channel as Node | undefined;
  if (rss) {
    return ((rss.item as Node[] | undefined) ?? []).flatMap((it) => {
      const links = (it.link as unknown[] | undefined) ?? [];
      const url = text(links[0]).trim() || text(it.guid).trim();
      const title = plain(text(it.title));
      if (!url || !title) return [];
      return [{ title, url, summary: plain(text(it.description)) || null, publishedAt: date(text(it.pubDate)) }];
    });
  }
  const feed = doc.feed as Node | undefined;
  if (feed) {
    return ((feed.entry as Node[] | undefined) ?? []).flatMap((e) => {
      const links = ((e.link as Node[] | undefined) ?? []);
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate");
      const url = String(alt?.["@_href"] ?? "").trim();
      const title = plain(text(e.title));
      if (!url || !title) return [];
      return [{ title, url, summary: plain(text(e.summary) || text(e.content)) || null, publishedAt: date(text(e.updated) || text(e.published)) }];
    });
  }
  throw new Error("not an RSS or Atom feed");
}

export interface FetchLimits {
  userAgent: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

/**
 * GET a URL as UTF-8 text (the spike found Onlinekhabar's text broke otherwise), with a time
 * limit, a size limit and at most 3 redirects. Sends no cookies. Returns null for a 404 (used
 * for robots.txt); throws on other failures.
 */
export async function fetchText(url: string, limits: FetchLimits): Promise<string | null> {
  const { userAgent, timeoutMs = 10_000, maxBytes = 5 * 1024 * 1024, maxRedirects = 3 } = limits;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const target = new URL(current);
    if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error(`refused ${target.protocol} URL`);
    const res = await fetch(target, {
      redirect: "manual",
      headers: { "user-agent": userAgent, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain;q=0.8, */*;q=0.5" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, target).toString();
      await res.body?.cancel();
      continue;
    }
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`larger than ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  }
  throw new Error(`more than ${maxRedirects} redirects`);
}
