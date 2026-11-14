import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ADR 0005: only the query layer talks to the database, so every SQL statement is registered
 * and lands in db/queries/.
 * - The client (lib/db/client.ts) may be imported only by lib/db/queries/run.ts.
 * - The driver ("postgres") and Drizzle's runtime may be imported only under lib/db/ and
 *   scripts/db/ (and drizzle.config.ts).
 */
const ROOT = join(import.meta.dirname, "..", "..");
const SCAN = ["app", "components", "lib", "scripts", "worker", "proxy.ts"];

/** Better Auth runs its own queries on the sign-in tables only (ADR 0006). */
const CLIENT_ALLOWED = ["lib/db/queries/run.ts", "lib/db/auth-adapter.ts"];

function walk(p: string): string[] {
  const s = statSync(p);
  if (!s.isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => (n === "node_modules" || n === "generated" ? [] : walk(join(p, n))));
}

const files = SCAN.flatMap((d) => walk(join(ROOT, d)))
  .filter((p) => /\.(ts|tsx|mts|mjs)$/.test(p))
  .map((p) => ({ rel: relative(ROOT, p).replaceAll("\\", "/"), text: readFileSync(p, "utf8") }));

function imports(text: string): string[] {
  return [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("database boundary", () => {
  it("only lib/db/queries/run.ts (and the sign-in adapter) import the database client", () => {
    const importsClient = (f: { rel: string; text: string }) =>
      imports(f.text).some((i) => {
        if (/(^|\/)db\/client$/.test(i)) return true; // "@/lib/db/client", "../../lib/db/client"
        if (!f.rel.startsWith("lib/db/")) return false;
        return i === "./client" || i === "../client"; // relative imports inside lib/db/
      });
    const offenders = files.filter((f) => !CLIENT_ALLOWED.includes(f.rel) && importsClient(f));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it("only lib/db/ and scripts/db/ import the driver or Drizzle's runtime", () => {
    const offenders = files
      // Database tests (*.db.test.ts) may write raw SQL to set up and inspect rows.
      .filter((f) => !f.rel.startsWith("lib/db/") && !f.rel.startsWith("scripts/db/") && !f.rel.endsWith(".db.test.ts"))
      .filter((f) => imports(f.text).some((i) => i === "postgres" || i === "drizzle-orm" || i.startsWith("drizzle-orm/")));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
