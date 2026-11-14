import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * The one database connection (ADR 0005). Only lib/db/queries/ may import this file;
 * `lib/db/boundary.test.ts` enforces it.
 *
 * Connects as role `app` (no DDL; audit_log is INSERT only). The pool is created on first use,
 * not at import, so builds and pages that never touch the database don't need it, and it is
 * kept on globalThis so dev hot reloads don't open a new pool each time.
 */
export type Db = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __sadakDb?: { sql: postgres.Sql; db: Db } };

export function db(): Db {
  if (!g.__sadakDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env.local)");
    const sql = postgres(url, { max: 10, idle_timeout: 30, connect_timeout: 10 });
    g.__sadakDb = { sql, db: drizzle(sql, { schema }) };
  }
  return g.__sadakDb.db;
}
