import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { Executor, Query } from "./queries/define";

/**
 * A database connection for code that runs outside Next.js: the worker (worker/index.ts) and the
 * server scripts (scripts/db/*). The website uses lib/db/client.ts instead. Queries still go
 * through the registry (ADR 0005): call `run(query, args)`.
 */
export function openDatabase(url: string | undefined, opts: { max?: number } = {}) {
  if (!url) throw new Error("No database URL: set it in .env.local or the server's environment file");
  const client = postgres(url, { max: opts.max ?? 2, onnotice: () => {} });
  const exec = drizzle(client, { schema }) as unknown as Executor;
  return {
    exec,
    run: <A, R>(query: Query<A, R>, args: A): Promise<R> => Promise.resolve(query.build(exec, args)),
    close: () => client.end(),
  };
}
