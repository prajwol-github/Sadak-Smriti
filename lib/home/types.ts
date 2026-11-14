/** Shapes the home page reads. Filled from the database from PLAN P1-08; from sample data until then. */

export type VehicleType =
  | "bus" | "microbus" | "jeep" | "car" | "truck" | "tipper" | "tanker" | "tractor"
  | "motorcycle" | "scooter" | "e_rickshaw" | "bicycle" | "other";

export interface Localised {
  en: string;
  ne: string;
}

export interface RecentCrash {
  slug: string;
  /** ISO date of the crash (not of the report). */
  occurredOn: string;
  title: Localised;
  place: Localised;
  highwayRef: string | null;
  km: number | null;
  vehicles: VehicleType[];
  killed: number;
  injured: number | null;
  /** A reviewer confirmed it (verification level reviewer_verified or higher). */
  verified: boolean;
  /** exact/place = a real point; local_unit/district = drawn hollow at the area's centre (SPEC 6.3). */
  precise: boolean;
  lon: number;
  lat: number;
}

export interface RememberedPerson {
  slug: string;
  name: Localised;
  age: number | null;
  diedOn: string;
  /** Path to a photo, or null to show the initial. */
  photo: string | null;
}

export interface HomeData {
  /** ISO date recording started. */
  recordingSince: string;
  deaths: number;
  crashes: number;
  police: { deaths: number; fiscalYear: string } | null;
  recent: RecentCrash[];
  remembered: RememberedPerson[];
  /** True when the page shows invented sample data; the page then says so. */
  sample: boolean;
}
