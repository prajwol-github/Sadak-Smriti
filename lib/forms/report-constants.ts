/**
 * Report form constants, kept apart from the schema so the browser bundle doesn't pull in Zod
 * or the BS calendar library (SPEC 11.4 JavaScript budget).
 */

/** Vehicle chips offered on the form, most common first. */
export const REPORT_VEHICLES = ["bus", "microbus", "jeep", "car", "truck", "tipper", "motorcycle", "scooter", "bicycle", "other"] as const;

export const REPORT_LIMITS = { placeName: 120, witness: 1000, url: 2000, contact: 200, count: 200, years: 20 } as const;
