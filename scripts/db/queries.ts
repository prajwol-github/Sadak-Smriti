/**
 * pnpm db:queries — writes db/queries/<area>/<name>.sql for every registered query and deletes
 * snapshots whose query no longer exists (ADR 0005). Commit the result with the code change.
 */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expectedSnapshots } from "../../lib/db/queries/snapshots";

const ROOT = "db/queries";

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  } catch {
    return [];
  }
}

const expected = expectedSnapshots();
let written = 0;
for (const [path, text] of expected) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  written++;
}
for (const file of walk(ROOT).map((p) => p.replaceAll("\\", "/"))) {
  if (file.endsWith(".sql") && !expected.has(file)) {
    rmSync(file);
    console.log(`  removed ${file} (no such query)`);
  }
}
console.log(`Wrote ${written} query snapshot(s) to ${ROOT}/`);
