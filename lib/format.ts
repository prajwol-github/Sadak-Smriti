import { BS_MONTHS, adToBs, formatAd, formatBs, toNepaliDigits } from "@/lib/domain/bs-date";

export type Locale = "ne" | "en";

/** 1184 -> "1,184" (en) or "१,१८४" (ne). Indian grouping (lakh) as used in Nepal. */
export function fmtNum(n: number, locale: Locale): string {
  const s = n.toLocaleString("en-IN");
  return locale === "ne" ? toNepaliDigits(s) : s;
}

/** Digits in the visitor's script, for strings that already contain numbers ("km 112–117"). */
export function digits(s: string, locale: Locale): string {
  return locale === "ne" ? toNepaliDigits(s) : s;
}

/** Picks the visitor's language from a two-language value. */
export function l10n<T>(v: { en: T; ne: T }, locale: Locale): T {
  return v[locale];
}


const WEEKDAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ne: ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"],
};

/** "26 Kartik" (en) or "कात्तिक २६" (ne): a BS date without the year, for this-year lists. */
export function bsShort(iso: string, locale: Locale): string {
  const { month, day } = adToBs(iso);
  return locale === "ne" ? `${BS_MONTHS.ne[month - 1]} ${toNepaliDigits(day)}` : `${day} ${BS_MONTHS.en[month - 1]}`;
}

/** "26 Kartik 2083" (en) or "कात्तिक २६, २०८३" (ne). */
export function bsLong(iso: string, locale: Locale): string {
  return formatBs(adToBs(iso), locale);
}

/** "12 Nov 2026" (en) or "नोभेम्बर १२, २०२६" (ne). */
export function adShort(iso: string, locale: Locale): string {
  return formatAd(iso, locale, { short: true });
}

/** "Wed" / "बुध". */
export function weekdayShort(iso: string, locale: Locale): string {
  return WEEKDAYS[locale][new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** "1 Baisakh" style month name for a 1-based BS month. */
export function bsMonthName(month: number, locale: Locale): string {
  return BS_MONTHS[locale][month - 1];
}
