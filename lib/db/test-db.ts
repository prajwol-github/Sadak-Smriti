import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { Executor } from "./queries/define";

/**
 * For *.db.test.ts only: a connection as role `app` (what the website uses), and a helper that
 * runs each test inside a transaction that is always rolled back, so tests leave no rows behind.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets the variables directly.
}

export function testDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; run pnpm db:up first");
  const client = postgres(url, { max: 2, onnotice: () => {} });
  return { db: drizzle(client, { schema }), end: () => client.end() };
}

class Rollback extends Error {}

/** Runs `fn` in a transaction and rolls it back. Returns what `fn` returned. */
export async function inRollback<T>(db: ReturnType<typeof testDb>["db"], fn: (tx: Executor) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as Executor);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return result as T;
}

/** The Postgres error code of a failed statement, e.g. "23514" (check) or "42501" (permission). */
export async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "no error";
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.code ?? err.cause?.code ?? String(e);
  }
}
