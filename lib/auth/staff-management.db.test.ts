import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { pgError, testDb } from "@/lib/db/test-db";

/**
 * Migration 0007 against the real database: staff_set_role and staff_set_ban enforce the account
 * rules whatever the website does (ADR 0006). Needs `pnpm db:up` and `pnpm db:migrate`.
 *
 * The rules run inside a `migrator` transaction that is always rolled back, because fixtures
 * (reviewers, admins) cannot be created as role `app`. The functions are SECURITY DEFINER, so they
 * behave the same called from `app`; what `app` may and may not do is tested separately below.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets the variables directly.
}
const migrator = postgres(process.env.MIGRATOR_DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
const { db: appDb, end: endApp } = testDb();
afterAll(async () => {
  await migrator.end();
  await endApp();
});

type Tx = postgres.TransactionSql;
class Rollback extends Error {}
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await migrator.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

let n = 0;
async function mk(tx: Tx, role: string, opts: { twoFactor?: boolean; banned?: boolean } = {}): Promise<string> {
  n++;
  const [u] = await tx`
    insert into users (name, email, role, two_factor_enabled, banned_at)
    values (${`Example ${role} ${n}`}, ${`example-${role}-${n}@example.invalid`}, ${role}, ${opts.twoFactor ?? true}, ${opts.banned ? new Date() : null})
    returning id`;
  await tx`insert into sessions (token, user_id, expires_at) values (${`token-${n}-${Math.random()}`}, ${u.id}, now() + interval '1 day')`;
  return u.id;
}

/** The message of the error the database raised, or null if it succeeded. */
async function refused(tx: Tx, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await tx.savepoint(async () => {
      await fn();
    });
    return null;
  } catch (e) {
    return (e as { message?: string }).message ?? String(e);
  }
}

const setRole = (tx: Tx, actor: string, target: string, role: string) => tx`select staff_set_role(${actor}::uuid, ${target}::uuid, ${role}::user_role)`;
const setBan = (tx: Tx, actor: string, target: string, ban: boolean, reason = "Example reason") => tx`select staff_set_ban(${actor}::uuid, ${target}::uuid, ${ban}, ${reason})`;
const roleOf = async (tx: Tx, id: string) => (await tx`select role from users where id = ${id}`)[0].role;
const bannedOf = async (tx: Tx, id: string) => (await tx`select banned_at is not null as banned from users where id = ${id}`)[0].banned;
const sessionCount = async (tx: Tx, id: string) => (await tx`select count(*)::int as n from sessions where user_id = ${id}`)[0].n;
const auditActions = async (tx: Tx, id: string) => (await tx`select action from audit_log where target_id = ${id} order by at, id`).map((r) => r.action);

describe("staff_set_role", () => {
  it("an admin makes a contributor a reviewer, ends their sessions and logs it", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const person = await mk(tx, "contributor");
      await setRole(tx, admin, person, "reviewer");
      expect(await roleOf(tx, person)).toBe("reviewer");
      expect(await sessionCount(tx, person)).toBe(0);
      const [row] = await tx`select actor_id, after from audit_log where target_id = ${person}`;
      expect(row.actor_id).toBe(admin);
      expect(row.after).toMatchObject({ from: "contributor", to: "reviewer", via: "website" });
    }));

  it("an admin makes a reviewer a contributor again", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const person = await mk(tx, "reviewer");
      await setRole(tx, admin, person, "contributor");
      expect(await roleOf(tx, person)).toBe("contributor");
    }));

  it("a no-op change writes nothing and keeps the person signed in", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const person = await mk(tx, "reviewer");
      await setRole(tx, admin, person, "reviewer");
      expect(await sessionCount(tx, person)).toBe(1);
      expect(await auditActions(tx, person)).toEqual([]);
    }));

  it("a reviewer cannot change roles", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const person = await mk(tx, "contributor");
      expect(await refused(tx, () => setRole(tx, reviewer, person, "reviewer"))).toMatch(/only an admin/);
      expect(await roleOf(tx, person)).toBe("contributor");
    }));

  it("an admin without an authenticator app, or who is deactivated, cannot", () =>
    inRollback(async (tx) => {
      const noApp = await mk(tx, "admin", { twoFactor: false });
      const banned = await mk(tx, "admin", { banned: true });
      const person = await mk(tx, "contributor");
      expect(await refused(tx, () => setRole(tx, noApp, person, "reviewer"))).toMatch(/only an admin/);
      expect(await refused(tx, () => setRole(tx, banned, person, "reviewer"))).toMatch(/only an admin/);
    }));

  it("nobody becomes an admin, and an admin cannot be changed", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const other = await mk(tx, "admin");
      const person = await mk(tx, "contributor");
      expect(await refused(tx, () => setRole(tx, admin, person, "admin"))).toMatch(/only moves accounts between/);
      expect(await refused(tx, () => setRole(tx, admin, other, "contributor"))).toMatch(/only moves accounts between/);
      expect(await roleOf(tx, person)).toBe("contributor");
      expect(await roleOf(tx, other)).toBe("admin");
    }));

  it("trusted accounts are left to the server", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const person = await mk(tx, "trusted");
      expect(await refused(tx, () => setRole(tx, admin, person, "reviewer"))).toMatch(/only moves accounts between/);
    }));

  it("an admin cannot change their own role", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      expect(await refused(tx, () => setRole(tx, admin, admin, "contributor"))).toMatch(/your own role/);
    }));

  it("an unknown account is refused", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      expect(await refused(tx, () => setRole(tx, admin, "00000000-0000-0000-0000-000000000000", "reviewer"))).toMatch(/no such account/);
    }));
});

describe("staff_set_ban", () => {
  it("a reviewer deactivates a contributor, ends their sessions and logs it with the reason", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const person = await mk(tx, "contributor");
      await setBan(tx, reviewer, person, true, "Spam reports");
      expect(await bannedOf(tx, person)).toBe(true);
      expect(await sessionCount(tx, person)).toBe(0);
      const [row] = await tx`select actor_id, action, after from audit_log where target_id = ${person}`;
      expect(row).toMatchObject({ actor_id: reviewer, action: "user.deactivate" });
      expect(row.after).toMatchObject({ reason: "Spam reports", role: "contributor" });
    }));

  it("reactivating clears the ban and logs it", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const person = await mk(tx, "contributor", { banned: true });
      await setBan(tx, reviewer, person, false);
      expect(await bannedOf(tx, person)).toBe(false);
      expect(await auditActions(tx, person)).toEqual(["user.reactivate"]);
    }));

  it("a reviewer cannot deactivate a reviewer or an admin", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const otherReviewer = await mk(tx, "reviewer");
      const admin = await mk(tx, "admin");
      expect(await refused(tx, () => setBan(tx, reviewer, otherReviewer, true))).toMatch(/may not change/);
      expect(await refused(tx, () => setBan(tx, reviewer, admin, true))).toMatch(/may not change/);
    }));

  it("an admin deactivates a reviewer but never an admin", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      const otherAdmin = await mk(tx, "admin");
      const reviewer = await mk(tx, "reviewer");
      await setBan(tx, admin, reviewer, true);
      expect(await bannedOf(tx, reviewer)).toBe(true);
      expect(await refused(tx, () => setBan(tx, admin, otherAdmin, true))).toMatch(/may not change/);
    }));

  it("nobody deactivates themselves", () =>
    inRollback(async (tx) => {
      const admin = await mk(tx, "admin");
      expect(await refused(tx, () => setBan(tx, admin, admin, true))).toMatch(/yourself/);
    }));

  it("a contributor, or a staff member without the authenticator app, cannot", () =>
    inRollback(async (tx) => {
      const contributor = await mk(tx, "contributor");
      const noApp = await mk(tx, "reviewer", { twoFactor: false });
      const person = await mk(tx, "contributor");
      expect(await refused(tx, () => setBan(tx, contributor, person, true))).toMatch(/only a reviewer or admin/);
      expect(await refused(tx, () => setBan(tx, noApp, person, true))).toMatch(/only a reviewer or admin/);
    }));

  it("repeating a change does nothing", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const person = await mk(tx, "contributor");
      await setBan(tx, reviewer, person, true);
      await setBan(tx, reviewer, person, true);
      expect(await auditActions(tx, person)).toEqual(["user.deactivate"]);
    }));

  it("the reason is cut at 200 characters", () =>
    inRollback(async (tx) => {
      const reviewer = await mk(tx, "reviewer");
      const person = await mk(tx, "contributor");
      await setBan(tx, reviewer, person, true, "x".repeat(500));
      const [row] = await tx`select ban_reason from users where id = ${person}`;
      expect(row.ban_reason).toHaveLength(200);
    }));
});

describe("what the website's own database role may do", () => {
  it("cannot write the ban columns directly", async () => {
    expect(await pgError(appDb.execute(`update users set banned_at = now() where false` as never))).toBe("42501");
  });

  it("can call the functions, which then apply the rules", async () => {
    const msg = await appDb.execute(`select staff_set_role('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'reviewer')` as never).then(
      () => "no error",
      (e: { cause?: { message?: string }; message?: string }) => e.cause?.message ?? e.message ?? "",
    );
    expect(msg).toMatch(/only an admin/);
  });
});
