import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * PLAN P0-09 / SPEC 12.2: every server action and API route calls the policy module.
 * This scans app/ and fails if a route handler or a "use server" file never calls can()/canDecide().
 *
 * A route that is public by design (the health check) must still say so explicitly, by calling
 * can(actor, "read_public"), or be listed below with the reason.
 */
const EXEMPT: Record<string, string> = {
  // "app/api/health/route.ts": "infrastructure probe, returns no data",
  "app/api/auth/[...all]/route.ts":
    "Better Auth's HTTP surface, cut to Google's return address and the error page; every other path is 404 (lib/auth/route.test.ts, audit finding 1). The callback signs in only the caller's own account and grants no role (ADR 0006)",
  "app/[locale]/account/two-factor/actions.ts":
    "the staff code check itself: can() withholds staff powers until it succeeds, so it checks the reviewer/admin role directly and refuses everyone else (ADR 0006)",
};

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function needsPolicy(path: string, text: string): boolean {
  const isRoute = /[\\/]route\.(ts|tsx)$/.test(path);
  const isServerActions = /^\s*["']use server["']/m.test(text);
  return isRoute || isServerActions;
}

describe("policy coverage", () => {
  it("every route handler and server action file calls the policy", () => {
    const missing = walk(join(ROOT, "app"))
      .filter((p) => /\.(ts|tsx)$/.test(p))
      .map((p) => ({ rel: relative(ROOT, p).replaceAll("\\", "/"), text: readFileSync(p, "utf8") }))
      .filter(({ rel, text }) => needsPolicy(rel, text) && !EXEMPT[rel])
      .filter(({ text }) => !/\bcan(Decide|ChangeRole|Deactivate)?\s*\(/.test(text) || !/from\s+["']@\/lib\/policy\/can["']/.test(text))
      .map(({ rel }) => rel);
    expect(missing).toEqual([]);
  });
});
