import "server-only";
import { db } from "../client";
import type { Executor, Query } from "./define";

/**
 * Runs a registered query (ADR 0005). Pass `tx` to run it inside a transaction.
 * App code imports this file and the query definitions; nothing else in the app touches the
 * database client.
 */
export async function run<A, R>(query: Query<A, R>, args: A, tx?: Executor): Promise<R> {
  return await query.build(tx ?? db(), args);
}

/** Runs `fn` in one transaction: every write and its revision and audit rows commit together. */
export function transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  return db().transaction(fn);
}
