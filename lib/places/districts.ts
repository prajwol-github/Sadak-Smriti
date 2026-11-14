/**
 * District names, shared by the places import (database) and the map build (static map files),
 * so both agree on every district's English name, Nepali name and slug. See ADR 0002.
 *
 * Names come from sagautam5/local-states-nepal (data/raw/names/, `pnpm db:places:download`);
 * the boundary file (Open Knowledge Nepal) spells 13 districts differently.
 */

/** Boundary-file district names that the names dataset spells differently (checked by hand). */
export const DISTRICT_ALIASES: Record<string, string> = {
  ACHHAM: "Acham", CHITAWAN: "Chitwan", KABHREPALANCHOK: "Kavrepalanchok", KAPILBASTU: "Kapilvastu",
  MAKAWANPUR: "Makwanpur", NAWALPARASI_E: "Nawalpur", NAWALPARASI_W: "Parasi", PANCHTHAR: "Pachthar",
  PARBAT: "Parwat", RAMECHHAP: "Ramechap", RUKUM_E: "Eastern Rukum", RUKUM_W: "Western Rukum", TANAHU: "Tanahun",
};

/** The names dataset's English district spellings that are typos of the official names. */
export const DISTRICT_EN_FIXES: Record<string, string> = { Acham: "Achham", Pachthar: "Panchthar", Parwat: "Parbat", Ramechap: "Ramechhap" };

export const letters = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface NameRow { id: number; name: string; province_id?: number }

/** Finds the names-dataset district for a boundary-file name ("CHITAWAN" → Chitwan). */
export function datasetDistrict(okfnName: string, districtsEn: NameRow[]): NameRow {
  const key = letters(DISTRICT_ALIASES[okfnName] ?? okfnName);
  const d = districtsEn.find((x) => letters(x.name) === key);
  if (!d) throw new Error(`No district in the names dataset for boundary district "${okfnName}"`);
  return d;
}

/** The name and slug we publish for a names-dataset district. */
export function canonicalDistrict(row: NameRow): { nameEn: string; slug: string } {
  const nameEn = DISTRICT_EN_FIXES[row.name] ?? row.name;
  return { nameEn, slug: slugify(nameEn) };
}
