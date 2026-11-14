/**
 * Bikram Sambat (BS) dates. The only module that talks to the conversion library (PLAN P0-06);
 * everything else uses these functions.
 *
 * Dates are passed around as ISO strings ("2026-11-13"), never as JS Date objects: a crash
 * happens on a calendar day in Nepal, and a Date carries a time zone that can shift it by a day.
 *
 * Supported range: BS 2000-2090 (about AD 1943-2034), the range of the library's calendar table.
 */
import NepaliDate from "nepali-date-converter";

export interface BsDate {
  year: number;
  /** 1 = Baisakh ... 12 = Chaitra */
  month: number;
  day: number;
}

export type DateLocale = "ne" | "en";

export const BS_MIN_YEAR = 2000;
export const BS_MAX_YEAR = 2090;

export const BS_MONTHS = {
  en: ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"],
  ne: ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"],
} as const;

const AD_MONTHS_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];
const AD_MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The Nepali fiscal year starts on 1 Shrawan (SPEC 9.1). */
const FISCAL_YEAR_START_MONTH = 4;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class BsDateRangeError extends RangeError {}

function parseIso(iso: string): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new TypeError(`expected a date as YYYY-MM-DD, got "${iso}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Reject impossible dates such as 2026-02-30 instead of letting Date roll them over.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    throw new TypeError(`"${iso}" is not a real calendar date`);
  }
  return [y, mo, d];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function assertBsYear(year: number) {
  if (year < BS_MIN_YEAR || year > BS_MAX_YEAR) {
    throw new BsDateRangeError(`BS year ${year} is outside the supported range ${BS_MIN_YEAR}-${BS_MAX_YEAR}`);
  }
}

/** AD (ISO date) to BS. */
export function adToBs(iso: string): BsDate {
  const [y, m, d] = parseIso(iso);
  // A local-midnight Date: the library reads local fields, so this is time-zone safe.
  const nd = NepaliDate.fromAD(new Date(y, m - 1, d));
  const bs = { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() };
  assertBsYear(bs.year);
  return bs;
}

/** BS to AD (ISO date). Throws on a day that does not exist in that BS month. */
export function bsToAd(bs: BsDate): string {
  assertBsYear(bs.year);
  if (bs.month < 1 || bs.month > 12 || bs.day < 1 || bs.day > 32) {
    throw new TypeError(`invalid BS date ${bs.year}-${bs.month}-${bs.day}`);
  }
  const nd = new NepaliDate(bs.year, bs.month - 1, bs.day);
  // The library rolls an overflowing day into the next month; refuse that.
  if (nd.getYear() !== bs.year || nd.getMonth() !== bs.month - 1 || nd.getDate() !== bs.day) {
    throw new TypeError(`BS ${bs.year}-${bs.month}-${bs.day} does not exist`);
  }
  const ad = nd.toJsDate();
  return `${ad.getFullYear()}-${pad(ad.getMonth() + 1)}-${pad(ad.getDate())}`;
}

const NEPALI_DIGITS = "०१२३४५६७८९";

/** 2083 -> "२०८३". */
export function toNepaliDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => NEPALI_DIGITS[Number(d)]);
}

/** "२०८३" -> "2083". Also used when reading numbers out of Nepali news text. */
export function fromNepaliDigits(value: string): string {
  return value.replace(/[०-९]/g, (d) => String(NEPALI_DIGITS.indexOf(d)));
}

/**
 * "27 Kartik 2083" (en) or "कात्तिक २७, २०८३" (ne), the order Nepali news datelines use.
 */
export function formatBs(bs: BsDate, locale: DateLocale): string {
  if (locale === "ne") {
    return `${BS_MONTHS.ne[bs.month - 1]} ${toNepaliDigits(bs.day)}, ${toNepaliDigits(bs.year)}`;
  }
  return `${bs.day} ${BS_MONTHS.en[bs.month - 1]} ${bs.year}`;
}

/**
 * "13 November 2026" (en) or "नोभेम्बर १३, २०२६" (ne). `short` gives "13 Nov 2026" for lists;
 * Nepali month names are already short.
 */
export function formatAd(iso: string, locale: DateLocale, opts: { short?: boolean } = {}): string {
  const [y, m, d] = parseIso(iso);
  if (locale === "ne") return `${AD_MONTHS_NE[m - 1]} ${toNepaliDigits(d)}, ${toNepaliDigits(y)}`;
  const month = opts.short ? AD_MONTHS_EN[m - 1].slice(0, 3) : AD_MONTHS_EN[m - 1];
  return `${d} ${month} ${y}`;
}

/** Both calendars for one ISO date, as shown on crash pages (SPEC 6.4). */
export function formatBoth(iso: string, locale: DateLocale): { bs: string; ad: string } {
  return { bs: formatBs(adToBs(iso), locale), ad: formatAd(iso, locale) };
}

/** Nepali fiscal year of a date, e.g. "2083/84". It starts on 1 Shrawan. */
export function fiscalYear(iso: string): string {
  const { year, month } = adToBs(iso);
  const start = month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
  return `${start}/${pad((start + 1) % 100)}`;
}

/**
 * True when two dates fall on the same BS day and month (any year): the anniversary rule for
 * "Remembered today" (SPEC 6.2, 6.7).
 */
export function isSameBsDayAndMonth(isoA: string, isoB: string): boolean {
  const a = adToBs(isoA);
  const b = adToBs(isoB);
  return a.month === b.month && a.day === b.day;
}

/** Today's date in Nepal (UTC+5:45) as an ISO string. */
export function todayInNepal(now: Date = new Date()): string {
  const nepal = new Date(now.getTime() + (5 * 60 + 45) * 60_000);
  return `${nepal.getUTCFullYear()}-${pad(nepal.getUTCMonth() + 1)}-${pad(nepal.getUTCDate())}`;
}
