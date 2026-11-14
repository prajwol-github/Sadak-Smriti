import { z } from "zod";
import { BsDateRangeError, bsToAd, todayInNepal } from "@/lib/domain/bs-date";

/**
 * The crash report form (docs/plans/report-a-crash.md section 3; SPEC 7.1).
 * One schema for the page, the server action and the tests. Every error is a key under
 * `Report.errors` in messages/*.json, so both languages say the same thing.
 */

import { REPORT_LIMITS, REPORT_VEHICLES } from "./report-constants";

export { REPORT_LIMITS, REPORT_VEHICLES };

export type ReportErrorKey =
  | "date" | "dateFuture" | "dateOld" | "time" | "district" | "killed" | "injured"
  | "source" | "url" | "tooLong" | "contact" | "location";

const count = (key: ReportErrorKey) =>
  z.coerce.number({ error: key }).int({ error: key }).min(0, { error: key }).max(REPORT_LIMITS.count, { error: key });

const text = (max: number) => z.string().trim().max(max, { error: "tooLong" }).optional();

const schema = z.object({
  calendar: z.enum(["bs", "ad"]).default("bs"),
  bsYear: z.coerce.number().int().optional(),
  bsMonth: z.coerce.number().int().optional(),
  bsDay: z.coerce.number().int().optional(),
  adDate: z.string().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "time" }).optional(),
  districtId: z.uuid({ error: "district" }),
  localUnitId: z.uuid({ error: "district" }).optional(),
  placeName: text(REPORT_LIMITS.placeName),
  killed: count("killed"),
  injured: count("injured").default(0),
  vehicles: z.array(z.enum(REPORT_VEHICLES)).max(REPORT_VEHICLES.length).default([]),
  sourceUrl: text(REPORT_LIMITS.url),
  witness: text(REPORT_LIMITS.witness),
  contact: text(REPORT_LIMITS.contact),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

export type ReportInput = z.input<typeof schema>;

export interface Report {
  occurredOn: string;
  occurredTime: string | null;
  districtId: string;
  localUnitId: string | null;
  placeName: string | null;
  killed: number;
  injured: number;
  vehicles: (typeof REPORT_VEHICLES)[number][];
  /** A news link, normalised for duplicate detection; null when the reporter saw it. */
  source: { kind: "news"; url: string; normalizedUrl: string } | { kind: "witness"; text: string };
  contact: string | null;
  location: { lat: number; lon: number } | null;
}

export type ParseResult = { ok: true; report: Report } | { ok: false; errors: Partial<Record<string, ReportErrorKey>> };

/** https://www.example.com/a/?utm_source=x#top → example.com/a (for "same link" checks). */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$|share$)/i.test(k)) u.searchParams.delete(k);
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  const query = u.searchParams.toString();
  return `${host}${path}${query ? `?${query}` : ""}`;
}

function looksLikeContact(s: string): boolean {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true; // email
  return (s.match(/\d/g) ?? []).length >= 7 && /^[+\d\s()-]+$/.test(s); // phone
}

/** FormData → plain input: empty strings become "not given", vehicles may repeat. */
export function formDataToInput(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$") || k === "vehicles") continue;
    const t = v.trim();
    if (t !== "") out[k] = t;
  }
  out.vehicles = fd.getAll("vehicles").filter((v): v is string => typeof v === "string" && v !== "");
  return out;
}

/**
 * Validates a report. `today` is an ISO date in Nepal (injectable for tests).
 * Returns field → error key, or the normalised report.
 */
export function parseReport(input: unknown, today: string = todayInNepal()): ParseResult {
  const parsed = schema.safeParse(input);
  const errors: Partial<Record<string, ReportErrorKey>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= (issue.message as ReportErrorKey) || "date";
    }
  }

  const v = parsed.success ? parsed.data : (input as Record<string, string | undefined>);

  // Date: BS selects or an AD date.
  let occurredOn: string | null = null;
  try {
    if ((v.calendar ?? "bs") === "ad") {
      occurredOn = typeof v.adDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.adDate) ? v.adDate : null;
    } else if (v.bsYear && v.bsMonth && v.bsDay) {
      occurredOn = bsToAd({ year: Number(v.bsYear), month: Number(v.bsMonth), day: Number(v.bsDay) });
    }
  } catch (e) {
    if (!(e instanceof BsDateRangeError || e instanceof TypeError)) throw e;
  }
  if (!occurredOn) errors.date ??= "date";
  else if (occurredOn > today) errors.date = "dateFuture";
  else if (Number(today.slice(0, 4)) - Number(occurredOn.slice(0, 4)) > REPORT_LIMITS.years) errors.date = "dateOld";

  // Source: a news link or a witness statement.
  const url = typeof v.sourceUrl === "string" ? v.sourceUrl.trim() : "";
  const witness = typeof v.witness === "string" ? v.witness.trim() : "";
  const normalizedUrl = url ? normalizeUrl(url) : null;
  if (url && !normalizedUrl) errors.sourceUrl ??= "url";
  if (!url && !witness) errors.source = "source";

  const contact = typeof v.contact === "string" ? v.contact.trim() : "";
  if (contact && !looksLikeContact(contact)) errors.contact ??= "contact";

  if ((v.lat === undefined) !== (v.lon === undefined)) errors.lat = "location";

  if (!parsed.success || Object.keys(errors).length > 0 || !occurredOn) return { ok: false, errors };

  const d = parsed.data;
  return {
    ok: true,
    report: {
      occurredOn,
      occurredTime: d.time ?? null,
      districtId: d.districtId,
      localUnitId: d.localUnitId ?? null,
      placeName: d.placeName || null,
      killed: d.killed,
      injured: d.injured,
      vehicles: [...new Set(d.vehicles)],
      source: normalizedUrl ? { kind: "news", url, normalizedUrl } : { kind: "witness", text: witness },
      contact: contact || null,
      location: d.lat !== undefined && d.lon !== undefined ? { lat: d.lat, lon: d.lon } : null,
    },
  };
}
