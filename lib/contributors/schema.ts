import { z } from "zod";

/**
 * The people who build and keep Sadak Smriti (content/contributors.json). Listing is opt-in:
 * people add themselves by pull request (content/README.md), so nobody is shown without asking
 * (SPEC 10.5: contributors are credited by name only if they choose to be).
 *
 * Photos are files in public/contributors/, never hotlinked: the site loads images only from
 * its own server (SPEC 12.2), and LinkedIn does not allow its photos to be loaded or copied.
 */

export const ROLES = ["code", "review", "volunteer", "translation", "design", "data", "donor"] as const;
export const HIGHLIGHTS = ["commits", "reviews", "reports", "translations", "months"] as const;

const https = z.url({ protocol: /^https$/, error: "must be an https:// link" });

export const contributorSchema = z.object({
  /** URL part of their page: /contribute/<handle>. Lowercase letters, digits and dashes. */
  handle: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/),
  name: z.object({ en: z.string().min(1).max(80), ne: z.string().max(80).optional() }),
  roles: z.array(z.enum(ROLES)).min(1),
  bio: z.object({ en: z.string().max(240), ne: z.string().max(240).optional() }).optional(),
  /** A file under /contributors/, e.g. "/contributors/asha.jpg" (square, at least 400 px). */
  photo: z.string().regex(/^\/contributors\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/).optional(),
  github: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/).optional(),
  linkedin: https.refine((u) => /^https:\/\/(www\.)?linkedin\.com\/in\/[^/]+\/?$/.test(u), "must be a linkedin.com/in/… profile").optional(),
  website: https.optional(),
  /** When they started (ISO date); shown in BS and AD. */
  since: z.iso.date(),
  /** Numbers for their profile and share card, e.g. { "commits": 128 }. */
  highlights: z.partialRecord(z.enum(HIGHLIGHTS), z.int().min(1).max(1_000_000)).default({}),
  /** Invented example entry: shown with a "sample" mark, removed once real people are listed. */
  sample: z.boolean().default(false),
});

export const contributorsFileSchema = z.object({
  contributors: z.array(contributorSchema),
  /** Donors who asked not to be named. Amounts are never published here. */
  anonymousDonors: z.int().min(0).default(0),
});

export type Contributor = z.infer<typeof contributorSchema>;
export type Role = (typeof ROLES)[number];
export type Highlight = (typeof HIGHLIGHTS)[number];
