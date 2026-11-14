import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema";
import { renderSnapshot, type Executor } from "./define";
import { QUERY_MODULES } from "./index";

/**
 * The expected contents of db/queries/: path (relative to the repo root) → file text.
 * Uses Drizzle's mock client, which renders SQL without connecting (checked 13 Nov 2026 with
 * drizzle-orm 0.45.4; see db/README.md).
 */
export function expectedSnapshots(): Map<string, string> {
  const mock = drizzle.mock({ schema }) as unknown as Executor;
  const out = new Map<string, string>();
  for (const { file, queries } of QUERY_MODULES) {
    for (const q of Object.values(queries)) {
      const path = `db/queries/${q.name}.sql`;
      if (out.has(path)) throw new Error(`Two queries are named "${q.name}"`);
      out.set(path, renderSnapshot(q, mock, file));
    }
  }
  return out;
}
