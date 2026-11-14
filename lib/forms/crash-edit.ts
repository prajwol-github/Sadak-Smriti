import { todayInNepal } from "@/lib/domain/bs-date";
import { normalizeUrl } from "@/lib/forms/report";

/**
 * Validation for the staff crash and person editor (ADR 0008). Pure functions over form values,
 * so every rule is unit tested. The workflow (lib/workflow/edit-crash.ts) re-checks the rules that
 * depend on the database (killed count, news source, version).
 *
 * Error codes are keys of the "Edit.error" messages, one per field.
 */

export type Raw = Record<string, string | string[] | undefined | null>;
export type Errors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Errors };

export const VEHICLE_TYPES = ["bus", "microbus", "jeep", "car", "truck", "tipper", "tanker", "tractor", "motorcycle", "scooter", "e_rickshaw", "bicycle", "other"] as const;
export const PERSON_STATUS = ["killed", "injured", "uninjured"] as const;
export const SEXES = ["female", "male", "other"] as const;
export const ROAD_USERS = ["driver", "passenger", "pedestrian", "rider", "pillion", "cyclist"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v[0] : v) ?? "";
const clean = (v: string) => v.normalize("NFC").replace(/\s+/g, " ").trim();

function text(raw: Raw, key: string, max: number, errors: Errors): string | null {
  const v = clean(first(raw[key]));
  if (v.length > max) errors[key] = "tooLong";
  return v === "" ? null : v;
}

function whole(raw: Raw, key: string, min: number, max: number, errors: Errors, required: boolean): number | null {
  const v = first(raw[key]).trim();
  if (v === "") {
    if (required) errors[key] = "required";
    return null;
  }
  const n = Number(v);
  if (!/^\d+$/.test(v) || !Number.isInteger(n) || n < min || n > max) {
    errors[key] = "number";
    return null;
  }
  return n;
}

function oneOf<T extends string>(raw: Raw, key: string, allowed: readonly T[], errors: Errors, required: boolean): T | null {
  const v = first(raw[key]).trim();
  if (v === "") {
    if (required) errors[key] = "required";
    return null;
  }
  if (!(allowed as readonly string[]).includes(v)) {
    errors[key] = "invalid";
    return null;
  }
  return v as T;
}

/** Why a staff member is changing something. Kept in the history (SPEC 4.2). */
function reason(raw: Raw, errors: Errors): string {
  const v = clean(first(raw.reason));
  if (v.length < 3) errors.reason = "reason";
  if (v.length > 300) errors.reason = "tooLong";
  return v;
}

function version(raw: Raw, errors: Errors): number {
  const n = Number(first(raw.version));
  if (!Number.isInteger(n) || n < 1) {
    errors.version = "invalid";
    return 0;
  }
  return n;
}

// --- Crash facts ----------------------------------------------------------------------------

export interface CrashFactsInput {
  version: number;
  reason: string;
  titleEn: string | null;
  titleNp: string | null;
  occurredOn: string;
  occurredTime: string | null;
  placeNameEn: string | null;
  placeNameNp: string | null;
  districtId: string;
  deaths: number;
  injured: number | null;
  vehicles: (typeof VEHICLE_TYPES)[number][];
}

export function parseCrashFacts(raw: Raw, now: Date = new Date()): Parsed<CrashFactsInput> {
  const errors: Errors = {};
  const titleEn = text(raw, "titleEn", 200, errors);
  const titleNp = text(raw, "titleNp", 200, errors);
  const placeNameEn = text(raw, "placeNameEn", 200, errors);
  const placeNameNp = text(raw, "placeNameNp", 200, errors);

  const occurredOn = first(raw.occurredOn).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || Number.isNaN(Date.parse(`${occurredOn}T00:00:00Z`)) || new Date(`${occurredOn}T00:00:00Z`).toISOString().slice(0, 10) !== occurredOn) {
    errors.occurredOn = "date";
  } else if (occurredOn > todayInNepal(now)) {
    errors.occurredOn = "future";
  } else if (occurredOn < "2000-01-01") {
    errors.occurredOn = "date";
  }

  const rawTime = first(raw.occurredTime).trim();
  let occurredTime: string | null = null;
  if (rawTime !== "") {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime)) occurredTime = rawTime;
    else errors.occurredTime = "time";
  }

  const districtId = first(raw.districtId).trim();
  if (!UUID.test(districtId)) errors.districtId = "required";

  const deaths = whole(raw, "deaths", 0, 1000, errors, true);
  const injured = whole(raw, "injured", 0, 5000, errors, false);

  const vehicleValues = (Array.isArray(raw.vehicles) ? raw.vehicles : raw.vehicles ? [raw.vehicles] : []).map((v) => v.trim()).filter(Boolean);
  const vehicles = [...new Set(vehicleValues)] as (typeof VEHICLE_TYPES)[number][];
  if (vehicles.some((v) => !(VEHICLE_TYPES as readonly string[]).includes(v))) errors.vehicles = "invalid";

  const why = reason(raw, errors);
  const v = version(raw, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { version: v, reason: why, titleEn, titleNp, occurredOn, occurredTime, placeNameEn, placeNameNp, districtId, deaths: deaths as number, injured, vehicles } };
}

// --- A person -------------------------------------------------------------------------------

export interface PersonInput {
  /** null when adding a person. */
  version: number | null;
  reason: string;
  status: (typeof PERSON_STATUS)[number];
  nameEn: string | null;
  nameNp: string | null;
  age: number | null;
  sex: (typeof SEXES)[number] | null;
  roadUser: (typeof ROAD_USERS)[number] | null;
  hometownText: string | null;
  nameVisibility: "public" | "hidden";
  publication: "draft" | "published";
  /** The family asked for an injured child's name to be shown (SPEC 2). */
  familyAskedToShow: boolean;
}

export function parsePerson(raw: Raw, mode: "add" | "edit"): Parsed<PersonInput> {
  const errors: Errors = {};
  const status = oneOf(raw, "status", PERSON_STATUS, errors, true);
  const nameEn = text(raw, "nameEn", 120, errors);
  const nameNp = text(raw, "nameNp", 120, errors);
  if (!nameEn && !nameNp && !errors.nameEn && !errors.nameNp) errors.nameEn = "name";
  const age = whole(raw, "age", 0, 120, errors, false);
  const sex = oneOf(raw, "sex", SEXES, errors, false);
  const roadUser = oneOf(raw, "roadUser", ROAD_USERS, errors, false);
  const hometownText = text(raw, "hometownText", 200, errors);
  const nameVisibility = oneOf(raw, "nameVisibility", ["public", "hidden"] as const, errors, false) ?? "public";
  const publication = oneOf(raw, "publication", ["draft", "published"] as const, errors, false) ?? "draft";
  const familyAskedToShow = first(raw.familyAskedToShow) === "on" || first(raw.familyAskedToShow) === "true";
  const why = reason(raw, errors);
  const v = mode === "edit" ? version(raw, errors) : null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { version: v, reason: why, status: status as PersonInput["status"], nameEn, nameNp, age, sex, roadUser, hometownText, nameVisibility, publication, familyAskedToShow },
  };
}

/**
 * An injured child's name is hidden unless the family asked to show it (SPEC 2: "injured children
 * (under 18) are hidden by default; the family can choose to show them"). Applied on every save.
 */
export function effectiveNameVisibility(p: Pick<PersonInput, "status" | "age" | "nameVisibility" | "familyAskedToShow">): "public" | "hidden" {
  if (p.status === "injured" && p.age !== null && p.age < 18 && !p.familyAskedToShow) return "hidden";
  return p.nameVisibility;
}

// --- A news link ---- (normalised exactly as the visitor report form does, because `sources.normalized_url` is unique across both)------------------------------------------------------------------------

export interface NewsLinkInput {
  url: string;
  normalizedUrl: string;
  reason: string;
}

export function parseNewsLink(raw: Raw): Parsed<NewsLinkInput> {
  const errors: Errors = {};
  const url = first(raw.url).trim();
  const normalized = url.length > 0 && url.length <= 2000 ? normalizeUrl(url) : null;
  if (!normalized) errors.url = url.length > 2000 ? "tooLong" : "url";
  const why = reason(raw, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { url, normalizedUrl: normalized as string, reason: why } };
}

// --- Publish, unpublish, remove, restore: a reason (and a version) only ---------------------

export function parseReasonOnly(raw: Raw): Parsed<{ reason: string }> {
  const errors: Errors = {};
  const why = reason(raw, errors);
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { reason: why } };
}

export function parsePublish(raw: Raw): Parsed<{ version: number; reason: string; publish: boolean }> {
  const errors: Errors = {};
  const why = reason(raw, errors);
  const v = version(raw, errors);
  const publish = first(raw.publish) === "true";
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { version: v, reason: why, publish } };
}

// --- Create a new crash (staff) -------------------------------------------------------------

export interface CrashCreateInput {
  reason: string;
  titleEn: string | null;
  titleNp: string | null;
  occurredOn: string;
  occurredTime: string | null;
  placeNameEn: string | null;
  placeNameNp: string | null;
  districtId: string;
  deaths: number;
  injured: number | null;
  vehicles: (typeof VEHICLE_TYPES)[number][];
}

/** Like parseCrashFacts but without a version field — used when creating a brand-new crash. */
export function parseCrashCreate(raw: Raw, now: Date = new Date()): Parsed<CrashCreateInput> {
  const errors: Errors = {};
  const titleEn = text(raw, "titleEn", 200, errors);
  const titleNp = text(raw, "titleNp", 200, errors);
  const placeNameEn = text(raw, "placeNameEn", 200, errors);
  const placeNameNp = text(raw, "placeNameNp", 200, errors);

  const occurredOn = first(raw.occurredOn).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || Number.isNaN(Date.parse(`${occurredOn}T00:00:00Z`)) || new Date(`${occurredOn}T00:00:00Z`).toISOString().slice(0, 10) !== occurredOn) {
    errors.occurredOn = "date";
  } else if (occurredOn > todayInNepal(now)) {
    errors.occurredOn = "future";
  } else if (occurredOn < "2000-01-01") {
    errors.occurredOn = "date";
  }

  const rawTime = first(raw.occurredTime).trim();
  let occurredTime: string | null = null;
  if (rawTime !== "") {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime)) occurredTime = rawTime;
    else errors.occurredTime = "time";
  }

  const districtId = first(raw.districtId).trim();
  if (!UUID.test(districtId)) errors.districtId = "required";

  const deaths = whole(raw, "deaths", 0, 1000, errors, true);
  const injured = whole(raw, "injured", 0, 5000, errors, false);

  const vehicleValues = (Array.isArray(raw.vehicles) ? raw.vehicles : raw.vehicles ? [raw.vehicles] : []).map((v) => v.trim()).filter(Boolean);
  const vehicles = [...new Set(vehicleValues)] as (typeof VEHICLE_TYPES)[number][];
  if (vehicles.some((v) => !(VEHICLE_TYPES as readonly string[]).includes(v))) errors.vehicles = "invalid";

  const why = reason(raw, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { reason: why, titleEn, titleNp, occurredOn, occurredTime, placeNameEn, placeNameNp, districtId, deaths: deaths as number, injured, vehicles } };
}
