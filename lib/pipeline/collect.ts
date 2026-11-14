import type { Executor } from "@/lib/db/queries/define";
import { enabledOutlets, insertFeedItem, outletFailed, outletSucceeded } from "@/lib/db/queries/pipeline";
import { fetchText, parseFeed } from "./feeds";
import { matchCrashNews } from "./filter";
import { normalizeUrl } from "./normalize-url";
import { isAllowedByRobots } from "./robots";

/**
 * One collection run (SPEC 7.2 steps 1–2): for each enabled outlet, read robots.txt, read the
 * feed, store every entry not seen before, and mark the ones that look like crash news. An outlet
 * that fails is recorded and skipped; the others still run.
 */

export const BOT_TOKEN = "SadakSmritiBot";

export interface OutletResult {
  slug: string;
  ok: boolean;
  items: number;
  new: number;
  candidates: number;
  error?: string;
}

export interface CollectionResult {
  itemsSeen: number;
  itemsNew: number;
  candidatesNew: number;
  outlets: OutletResult[];
}

export interface CollectDeps {
  /** Who we are, with a link that explains the bot (SPEC 7.2 "polite collection"). */
  userAgent: string;
  /** Replaced in tests. */
  fetchText?: typeof fetchText;
  /** Called when an outlet has failed this many times in a row (the admin alert, later by email). */
  onRepeatedFailure?: (slug: string, failures: number, error: string) => void;
}

export async function collectNews(exec: Executor, deps: CollectDeps): Promise<CollectionResult> {
  const get = deps.fetchText ?? fetchText;
  const result: CollectionResult = { itemsSeen: 0, itemsNew: 0, candidatesNew: 0, outlets: [] };

  for (const outlet of await enabledOutlets.build(exec, {})) {
    const r: OutletResult = { slug: outlet.slug, ok: false, items: 0, new: 0, candidates: 0 };
    try {
      const feed = new URL(outlet.feedUrl);
      const robots = await get(new URL("/robots.txt", feed).toString(), { userAgent: deps.userAgent });
      if (robots && !isAllowedByRobots(robots, BOT_TOKEN, feed.pathname + feed.search)) {
        throw new Error("robots.txt asks bots not to read this feed");
      }
      const xml = await get(feed.toString(), { userAgent: deps.userAgent });
      if (!xml) throw new Error("feed not found (HTTP 404)");

      const items = parseFeed(xml);
      r.items = items.length;
      for (const item of items) {
        const normalizedUrl = normalizeUrl(item.url);
        if (!normalizedUrl) continue;
        const { matched, terms } = matchCrashNews(item.title, item.summary ?? "");
        const inserted = await insertFeedItem.build(exec, {
          outletId: outlet.id, url: item.url, normalizedUrl, title: item.title.slice(0, 500),
          summary: item.summary, publishedAt: item.publishedAt, matched, matchedTerms: terms,
        });
        if (inserted.length > 0) {
          r.new++;
          if (matched) r.candidates++;
        }
      }
      await outletSucceeded.build(exec, { outletId: outlet.id });
      r.ok = true;
    } catch (e) {
      r.error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      const [row] = await outletFailed.build(exec, { outletId: outlet.id, error: r.error });
      if (row && row.consecutiveFailures >= 3) deps.onRepeatedFailure?.(outlet.slug, row.consecutiveFailures, r.error);
    }
    result.itemsSeen += r.items;
    result.itemsNew += r.new;
    result.candidatesNew += r.candidates;
    result.outlets.push(r);
  }
  return result;
}
