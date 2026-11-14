/**
 * Is this feed item probably about a road crash? (SPEC 7.2 step 2)
 *
 * Deliberately generous: a reviewer dismisses a wrong candidate in one click, but a missed crash
 * is a death never recorded. An item matches when its title or summary has a crash word and no
 * word for air travel (plane and helicopter crashes are not road crashes, SPEC 1).
 *
 * Nepali words are matched as parts of words, because Nepali adds endings to the stem
 * (दुर्घटना → दुर्घटनामा, ठोक्कियो → ठोक्किँदा). English words are matched as whole words.
 *
 * These are starting rules written on 14 Nov 2026; the spike's rules (`spike/collect_rss.py`) were
 * not in this checkout. Tune them with real misses and false alarms, and add a test for each change.
 */

const NE_CRASH = [
  "दुर्घटना", // accident
  "ठोक्कि", "ठक्कर", // collided, collision
  "खस्यो", "खसेर", "खस्दा", "खसेको", // fell (off the road)
  "पल्टियो", "पल्टिँदा", "पल्टिंदा", "पल्टिएर", "पल्टिएको", // overturned
  "किचियो", "किचिएर", "किच्दा", "किचिएको", // run over
  "बेपत्ता बस", // missing bus (river plunges)
];

const EN_CRASH = [
  "accident", "accidents", "crash", "crashes", "crashed", "collision", "collided", "collides",
  "plunged", "plunges", "veered off", "skidded off", "fell off the road", "went off the road",
  "overturned", "overturns", "run over", "ran over", "hit by a", "mishap", "road mishap",
];

const NE_EXCLUDE = ["विमान", "हेलिकप्टर", "जहाज"];
const EN_EXCLUDE = ["plane", "aircraft", "helicopter", "airline", "flight", "air crash", "stock market", "share market"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (words: string[]) => new RegExp(`\\b(${words.map(escape).join("|")})\\b`, "gi");
const EN_CRASH_RE = wordRe(EN_CRASH);
const EN_EXCLUDE_RE = wordRe(EN_EXCLUDE);

export interface FilterResult {
  matched: boolean;
  /** The crash words found, for the reviewer. */
  terms: string[];
}

export function matchCrashNews(title: string, summary = ""): FilterResult {
  const text = `${title}\n${summary}`.normalize("NFC");
  const lower = text.toLowerCase();

  const terms = new Set<string>();
  for (const w of NE_CRASH) if (text.includes(w)) terms.add(w);
  for (const m of lower.matchAll(EN_CRASH_RE)) terms.add(m[1].toLowerCase());

  const excluded = NE_EXCLUDE.some((w) => text.includes(w)) || EN_EXCLUDE_RE.test(lower);
  EN_EXCLUDE_RE.lastIndex = 0;

  return { matched: terms.size > 0 && !excluded, terms: [...terms] };
}
