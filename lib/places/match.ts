/**
 * Matches local-unit boundaries (Open Knowledge Nepal) to local-unit names (local-states-nepal)
 * within one district (PLAN P0-07, docs/plans/report-a-crash.md step 3).
 *
 * The two sources romanise names differently ("Shivasataxi" / "Shivasatakshi") and a few units
 * were renamed after the boundary data was made ("Belhi Chapena" → "Rajgadh"). Stages, strictest
 * first; each stage only pairs names that are unambiguous on both sides:
 *   exact     same letters
 *   spelling  same spelling key (folds common romanisation variants)
 *   contains  one spelling key contains the other ("Rupakot Majhuwagadhi" / "Diktel Rupakot …")
 *   similar   spelling keys at least 70% similar, mutual best (areas not required to agree)
 *   renamed   exactly one boundary and one name left in the district
 *   area      several left: paired by size order, only if every pair is within ±30%
 * Anything still unpaired is returned in `unmatched`; the import refuses to continue.
 * Every stage after "exact" is written to docs/data/place-name-matches.csv for human review.
 */

export interface Boundary {
  name: string;
  /** km², computed from the polygon */
  area: number;
}

export interface NamedUnit {
  code: number;
  name: string;
  /** km², from the names dataset */
  area: number;
}

export type Stage = "exact" | "spelling" | "contains" | "similar" | "renamed" | "area";

export interface Match {
  boundary: Boundary;
  unit: NamedUnit;
  stage: Stage;
  /** polygon area / official area */
  areaRatio: number;
}

export function letters(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
}

/** A spelling key that folds the usual variants of romanised Nepali place names. */
export function spellingKey(s: string): string {
  let k = letters(s);
  const rules: [RegExp, string][] = [
    [/ksh|x/g, "k"], // Laxmipur / Lakshmipur, Shivasataxi / Shivasatakshi
    [/chh/g, "c"],
    [/ch/g, "c"],
    [/ph/g, "f"],
    [/[vw]/g, "b"], // Triveni / Tribeni, Parwat / Parbat
    [/sh/g, "s"],
    [/ee/g, "i"],
    [/oo/g, "u"],
    [/y/g, "i"],
    [/h/g, ""], // aspirates and stray h: Bhimeshwor / Bhimeswor, Galchhi / Galchi
    [/[ou]/g, "a"], // Gokarneshwor / Gokarneshwar, Gauriganj / Gaurigunj
    [/(.)\1+/g, "$1"], // doubled letters
  ];
  for (const [re, to] of rules) k = k.replace(re, to);
  return k;
}

/** Levenshtein similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

const within = (ratio: number, tol: number) => ratio >= 1 - tol && ratio <= 1 / (1 - tol);

export function matchDistrict(boundaries: Boundary[], units: NamedUnit[]) {
  const matches: Match[] = [];
  let bs = [...boundaries];
  let us = [...units];

  const take = (b: Boundary, u: NamedUnit, stage: Stage) => {
    matches.push({ boundary: b, unit: u, stage, areaRatio: b.area / u.area });
    bs = bs.filter((x) => x !== b);
    us = us.filter((x) => x !== u);
  };

  /** Pairs b and u where `same` holds for exactly one candidate on each side. */
  const pairUnique = (stage: Stage, same: (b: Boundary, u: NamedUnit) => boolean) => {
    for (const b of [...bs]) {
      const cands = us.filter((u) => same(b, u));
      if (cands.length !== 1) continue;
      const back = bs.filter((x) => same(x, cands[0]));
      if (back.length === 1) take(b, cands[0], stage);
    }
  };

  pairUnique("exact", (b, u) => letters(b.name) === letters(u.name));
  pairUnique("spelling", (b, u) => spellingKey(b.name) === spellingKey(u.name));
  pairUnique("contains", (b, u) => {
    const kb = spellingKey(b.name);
    const ku = spellingKey(u.name);
    return Math.min(kb.length, ku.length) >= 4 && (kb.includes(ku) || ku.includes(kb));
  });

  // Mutual best by spelling similarity. Areas are not required to agree here: the names
  // dataset's areas predate the 2020 map in places, and some are wrong.
  for (const b of [...bs]) {
    const kb = spellingKey(b.name);
    const best = us.map((u) => ({ u, s: similarity(kb, spellingKey(u.name)) })).sort((x, y) => y.s - x.s)[0];
    if (!best || best.s < 0.7) continue;
    const ku = spellingKey(best.u.name);
    const rival = bs.some((x) => x !== b && similarity(spellingKey(x.name), ku) >= best.s);
    if (!rival) take(b, best.u, "similar");
  }

  // Renamed units. One left on each side: they can only be each other.
  if (bs.length === 1 && us.length === 1) {
    take(bs[0], us[0], "renamed");
  } else if (bs.length > 1 && bs.length === us.length) {
    // Several left: pair by size order, but only if every pair's area agrees within ±30%.
    const byArea = <T extends { area: number }>(xs: T[]) => [...xs].sort((x, y) => x.area - y.area);
    const sb = byArea(bs);
    const su = byArea(us);
    if (sb.every((b, i) => within(b.area / su[i].area, 0.3))) sb.forEach((b, i) => take(b, su[i], "area"));
  }

  return { matches, unmatched: { boundaries: bs, units: us } };
}
