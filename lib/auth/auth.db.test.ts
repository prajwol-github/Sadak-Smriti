import { afterAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import { sessions, users } from "@/lib/db/schema";
import { listAccounts } from "@/lib/db/queries/users";
import { inRollback, pgError, testDb } from "@/lib/db/test-db";
import { STAFF_CODE_LIMITS, hitStaffCodeLimit } from "@/lib/net/rate-limit";

/**
 * ADR 0006 against the real database (rolled back). Needs `pnpm db:up` and `pnpm db:migrate`.
 * The connection is role `app`, the one the website uses.
 */
const { db, end } = testDb();
afterAll(() => end());

const EMAIL = "db-test@example.invalid";

describe("who may set a role (migration 0005)", () => {
  it("a new account gets 'contributor' without the website naming a role", async () => {
    const role = await inRollback(db, async (tx) => {
      const r = await tx.execute<{ role: string }>(q`insert into users (name, email) values ('Example Person', ${EMAIL}) returning role`);
      return r[0].role;
    });
    expect(role).toBe("contributor");
  });

  it("Google sign-up works: Drizzle's insert names every column, with DEFAULT for role (migration 0006)", async () => {
    // Better Auth creates users through the Drizzle adapter, which emits exactly this shape.
    // Hand-written SQL that leaves `role` out passed while this failed, so test the real path.
    const row = await inRollback(db, async (tx) =>
      (await tx.insert(users).values({ name: "Example Person", email: EMAIL, emailVerified: true, twoFactorEnabled: false }).returning())[0],
    );
    expect(row.role).toBe("contributor");
  });

  it("the website cannot create an admin, even through Drizzle", async () => {
    const code = await inRollback(db, (tx) => pgError(tx.insert(users).values({ name: "Example Person", email: EMAIL, role: "admin" })));
    expect(code).toBe("42501");
  });

  it("the website cannot create an admin", async () => {
    const code = await inRollback(db, (tx) =>
      pgError(tx.execute(q`insert into users (name, email, role) values ('Example Person', ${EMAIL}, 'admin')`)),
    );
    expect(code).toBe("42501"); // insufficient_privilege
  });

  it("the website cannot promote anyone", async () => {
    const code = await inRollback(db, async (tx) => {
      await tx.execute(q`insert into users (name, email) values ('Example Person', ${EMAIL})`);
      return pgError(tx.execute(q`update users set role = 'admin' where email = ${EMAIL}`));
    });
    expect(code).toBe("42501");
  });

  it("the website can still update a name and the two-factor flag", async () => {
    const row = await inRollback(db, async (tx) => {
      await tx.execute(q`insert into users (name, email) values ('Example Person', ${EMAIL})`);
      const r = await tx.execute<{ name: string; two_factor_enabled: boolean }>(
        q`update users set name = 'Renamed Example', two_factor_enabled = true where email = ${EMAIL} returning name, two_factor_enabled`,
      );
      return r[0];
    });
    expect(row).toEqual({ name: "Renamed Example", two_factor_enabled: true });
  });
});

describe("staff code attempts (lib/net/rate-limit.ts)", () => {
  const NOW = new Date("2026-11-14T10:05:00Z");

  it(`allows ${STAFF_CODE_LIMITS.per15Min} attempts in 15 minutes and refuses the next`, async () => {
    const results = await inRollback(db, async (tx) => {
      const out = [];
      for (let i = 0; i <= STAFF_CODE_LIMITS.per15Min; i++) out.push((await hitStaffCodeLimit(tx, "user-a", NOW)).ok);
      return out;
    });
    expect(results).toEqual([...Array(STAFF_CODE_LIMITS.per15Min).fill(true), false]);
  });

  it("starts again in the next 15 minutes, until the daily cap", async () => {
    const results = await inRollback(db, async (tx) => {
      const out = [];
      for (let window = 0; window < 5; window++) {
        const t = new Date(NOW.getTime() + window * 15 * 60_000);
        for (let i = 0; i < STAFF_CODE_LIMITS.per15Min; i++) out.push((await hitStaffCodeLimit(tx, "user-b", t)).ok);
      }
      return out;
    });
    expect(results.filter(Boolean)).toHaveLength(STAFF_CODE_LIMITS.perDay);
    expect(results.at(-1)).toBe(false);
  });
});

describe("the accounts list (lib/db/queries/users.ts)", () => {
  it("shows each account's own last activity, not another account's", async () => {
    const [signedIn, never] = await inRollback(db, async (tx) => {
      const [a] = await tx.insert(users).values({ name: "Example Active", email: "db-test-active@example.invalid" }).returning();
      await tx.insert(users).values({ name: "Example Idle", email: "db-test-idle@example.invalid" });
      await tx.insert(sessions).values({ token: "db-test-token", userId: a.id, expiresAt: new Date(Date.now() + 86_400_000) });
      const rows = await listAccounts.build(tx, { limit: 100, offset: 0 });
      return [rows.find((r) => r.email === "db-test-active@example.invalid"), rows.find((r) => r.email === "db-test-idle@example.invalid")];
    });
    expect(signedIn?.lastSeen).toBeTruthy();
    expect(never?.lastSeen).toBeNull();
  });
});
