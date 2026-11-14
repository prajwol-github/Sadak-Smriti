import { describe, expect, it } from "vitest";
import dateConverter from "nepali-datetime/dateConverter";
import {
  BsDateRangeError,
  adToBs,
  bsToAd,
  fiscalYear,
  formatAd,
  formatBs,
  fromNepaliDigits,
  isSameBsDayAndMonth,
  toNepaliDigits,
  todayInNepal,
} from "./bs-date";

/**
 * Known BS/AD pairs: Nepali new year (1 Baisakh), the start of the fiscal year (1 Shrawan),
 * public days, and the spec's own example. Each is an anchor a reader can check in any
 * Nepali calendar; the full-range cross-check below covers every other day.
 */
const KNOWN: [bs: [number, number, number], ad: string, what: string][] = [
  [[2076, 1, 1], "2019-04-14", "New year 2076"],
  [[2077, 1, 1], "2020-04-13", "New year 2077"],
  [[2078, 1, 1], "2021-04-14", "New year 2078"],
  [[2079, 1, 1], "2022-04-14", "New year 2079"],
  [[2080, 1, 1], "2023-04-14", "New year 2080"],
  [[2081, 1, 1], "2024-04-13", "New year 2081"],
  [[2082, 1, 1], "2025-04-14", "New year 2082"],
  [[2083, 1, 1], "2026-04-14", "New year 2083"],
  [[2080, 4, 1], "2023-07-17", "Fiscal year 2080/81 starts"],
  [[2081, 4, 1], "2024-07-16", "Fiscal year 2081/82 starts"],
  [[2082, 4, 1], "2025-07-17", "Fiscal year 2082/83 starts"],
  [[2072, 6, 3], "2015-09-20", "Constitution promulgated"],
  [[2065, 2, 15], "2008-05-28", "Republic Day"],
  [[2083, 7, 26], "2026-11-12", "SPEC appendix B example slug"],
  [[2083, 7, 27], "2026-11-13", "Spec date (13 Nov 2026)"],
];

describe("adToBs / bsToAd", () => {
  it.each(KNOWN)("BS %j = AD %s (%s)", (bs, ad) => {
    expect(adToBs(ad)).toEqual({ year: bs[0], month: bs[1], day: bs[2] });
    expect(bsToAd({ year: bs[0], month: bs[1], day: bs[2] })).toBe(ad);
  });

  it("the day before each new year is the last day of Chaitra", () => {
    for (const year of [2077, 2080, 2083]) {
      const newYear = bsToAd({ year, month: 1, day: 1 });
      const d = new Date(`${newYear}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const eve = adToBs(d.toISOString().slice(0, 10));
      expect(eve.year).toBe(year - 1);
      expect(eve.month).toBe(12);
      expect(eve.day).toBeGreaterThanOrEqual(29);
    }
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => adToBs("13/11/2026")).toThrow(TypeError);
    expect(() => adToBs("2026-02-30")).toThrow(TypeError);
    expect(() => bsToAd({ year: 2083, month: 13, day: 1 })).toThrow(TypeError);
    // Kartik 2083 has fewer than 32 days; the library would silently roll over.
    expect(() => bsToAd({ year: 2083, month: 7, day: 32 })).toThrow(TypeError);
  });

  it("refuses dates outside the supported range instead of guessing", () => {
    expect(() => bsToAd({ year: 1999, month: 1, day: 1 })).toThrow(BsDateRangeError);
    expect(() => bsToAd({ year: 2091, month: 1, day: 1 })).toThrow(BsDateRangeError);
  });

  it("does not depend on the server's time zone", () => {
    // The ISO string is the only input; no Date with a zone is involved.
    expect(adToBs("2026-11-13")).toEqual({ year: 2083, month: 7, day: 27 });
  });
});

/**
 * Cross-check against a second, independently maintained calendar table (nepali-datetime). Two
 * tables agreeing on every day is a much stronger check than hand-picked pairs; a disagreement
 * names the exact day to look up.
 *
 * BS month lengths are not arithmetic: Nepal's calendar committee fixes them for each year. For
 * years not yet published, every library's table is a projection. On 13 Nov 2026 the two tables
 * agree on every day up to the end of BS 2083 and disagree from BS 2084 (see
 * docs/adr/0003-bs-date-library.md). When the official 2084 calendar is out, update the library,
 * then move SETTLED_UNTIL forward.
 */
const SETTLED_UNTIL = "2027-04-13"; // last day of BS 2083 (30 Chaitra 2083)

function mismatchesBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${startIso}T00:00:00Z`); t <= Date.parse(`${endIso}T00:00:00Z`); t += 86_400_000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const ours = adToBs(iso);
    const [y, m, d] = iso.split("-").map(Number);
    const [by, bm, bd] = dateConverter.englishToNepali(y, m - 1, d);
    if (ours.year !== by || ours.month !== bm + 1 || ours.day !== bd) {
      out.push(`${iso}: ours ${ours.year}-${ours.month}-${ours.day}, other ${by}-${bm + 1}-${bd}`);
    }
  }
  return out;
}

describe("cross-check with nepali-datetime", () => {
  it("both tables are really in use (guards against a silently empty check)", () => {
    expect(dateConverter.englishToNepali(2026, 10, 13)).toEqual([2083, 6, 27]);
  });

  it(`agrees on every day from BS 2001 to the end of BS 2083`, () => {
    expect(mismatchesBetween("1944-04-13", SETTLED_UNTIL).slice(0, 10)).toEqual([]);
  });

  it("still disagrees in BS 2084 (tripwire: when this fails, the tables converged; extend SETTLED_UNTIL)", () => {
    expect(mismatchesBetween("2027-04-14", "2028-04-12").length).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  it("formats BS dates in both languages", () => {
    expect(formatBs({ year: 2083, month: 7, day: 27 }, "en")).toBe("27 Kartik 2083");
    expect(formatBs({ year: 2083, month: 7, day: 27 }, "ne")).toBe("कात्तिक २७, २०८३");
  });

  it("formats AD dates in both languages", () => {
    expect(formatAd("2026-11-13", "en")).toBe("13 November 2026");
    expect(formatAd("2026-11-13", "ne")).toBe("नोभेम्बर १३, २०२६");
  });

  it("converts digits both ways", () => {
    expect(toNepaliDigits(2083)).toBe("२०८३");
    expect(fromNepaliDigits("मृत्यु १४ जना")).toBe("मृत्यु 14 जना");
  });
});

describe("fiscal year", () => {
  it("starts on 1 Shrawan", () => {
    expect(fiscalYear("2025-07-16")).toBe("2081/82"); // 31 Asar 2082, last day of FY 2081/82
    expect(fiscalYear("2025-07-17")).toBe("2082/83"); // 1 Shrawan 2082
    expect(fiscalYear("2026-11-13")).toBe("2083/84");
  });

  it("handles the century turn in the label", () => {
    // BS 2099 is outside the table; check the label arithmetic on 2089/90 instead.
    expect(fiscalYear(bsToAd({ year: 2089, month: 5, day: 1 }))).toBe("2089/90");
  });
});

describe("anniversaries", () => {
  it("matches the same BS day and month in another year", () => {
    const lastYear = bsToAd({ year: 2082, month: 7, day: 27 });
    expect(isSameBsDayAndMonth(lastYear, "2026-11-13")).toBe(true);
    expect(isSameBsDayAndMonth(lastYear, "2026-11-12")).toBe(false);
  });

  it("uses Nepal time for today", () => {
    // 20:00 UTC on 12 Nov is 01:45 on 13 Nov in Nepal.
    expect(todayInNepal(new Date("2026-11-12T20:00:00Z"))).toBe("2026-11-13");
    expect(todayInNepal(new Date("2026-11-12T18:00:00Z"))).toBe("2026-11-12");
  });
});
