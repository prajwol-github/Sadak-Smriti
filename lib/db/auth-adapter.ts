import "server-only";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./client";
import { accounts, sessions, twoFactors, users, verifications } from "./schema";

/**
 * Better Auth's database access (ADR 0006). This is the one exception to ADR 0005's rule that
 * every query is registered in lib/db/queries/: the library writes its own queries, and only on
 * the five sign-in tables below. `lib/db/boundary.test.ts` allows this file by name.
 *
 * The database itself stops these queries from writing `users.role` (migration 0005).
 */
export function authAdapter() {
  return drizzleAdapter(db(), {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications, twoFactor: twoFactors },
  });
}
