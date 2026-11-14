import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expectedSnapshots } from "./queries/snapshots";

/**
 * ADR 0005: db/queries/ holds the exact SQL of every query the app runs.
 * If this fails, run `pnpm db:queries` and commit the changed .sql files with your code.
 */
const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("db/queries snapshots", () => {
  const expected = expectedSnapshots();
  const onDisk = walk(join(ROOT, "db", "queries"))
    .filter((p) => p.endsWith(".sql"))
    .map((p) => relative(ROOT, p).replaceAll("\\", "/"));

  it("has at least one registered query", () => {
    expect(expected.size).toBeGreaterThan(0);
  });

  for (const [path, text] of expected) {
    it(`${path} is up to date`, () => {
      let actual = "";
      try {
        actual = readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n");
      } catch {
        // missing: compared below as empty
      }
      expect(actual, "run `pnpm db:queries` and commit the result").toBe(text);
    });
  }

  it("has no .sql file for a query that no longer exists", () => {
    expect(onDisk.filter((p) => !expected.has(p)), "run `pnpm db:queries` to remove stale files").toEqual([]);
  });
});
