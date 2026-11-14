import file from "@/content/contributors.json";
import { contributorsFileSchema, type Contributor, type Role } from "./schema";

/**
 * The contributor list, validated when the site builds: a bad entry fails the build with the
 * field that is wrong, instead of showing a broken card (content/README.md).
 */
const parsed = contributorsFileSchema.parse(file);

export const CONTRIBUTORS: Contributor[] = [...parsed.contributors].sort((a, b) => a.since.localeCompare(b.since) || a.handle.localeCompare(b.handle));
export const ANONYMOUS_DONORS = parsed.anonymousDonors;

/** The three groups on /contribute. One person can appear in more than one. */
export const GROUPS: { key: "code" | "people" | "donors"; roles: Role[] }[] = [
  { key: "code", roles: ["code", "design"] },
  { key: "people", roles: ["review", "volunteer", "translation", "data"] },
  { key: "donors", roles: ["donor"] },
];

export function contributorByHandle(handle: string): Contributor | undefined {
  return CONTRIBUTORS.find((c) => c.handle === handle);
}

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x", for display. */
export function shortUrl(url: string): string {
  return url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");
}
