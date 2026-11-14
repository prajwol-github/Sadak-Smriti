import { afterAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import type { Executor } from "./queries/define";
import { inRollback, pgError, testDb } from "./test-db";

/**
 * SPEC 10.7 and 12.3, enforced by the database itself, tested as role `app` (the website).
 * Every test runs in a transaction that is rolled back. Needs `pnpm db:up && pnpm db:migrate && pnpm db:places`.
 */
const { db, end } = testDb();
afterAll(() => end());

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const PERMISSION_DENIED = "42501";

/** Inserts a minimal draft crash in Kathmandu and returns the statement, for overriding fields. */
const insertCrash = (tx: Executor, over: { deaths?: number; occurredOn?: string } = {}) => tx.execute(q`
  insert into crashes (slug, occurred_on, province_id, district_id, deaths, created_via)
  select ${"test-" + Math.random().toString(36).slice(2)}, ${over.occurredOn ?? "2026-11-01"}, d.province_id, d.id, ${over.deaths ?? 1}, 'contributor'
  from districts d where d.slug = 'kathmandu'
  returning id`);

describe("database rules (SPEC 10.7)", () => {
  it("accepts a valid draft crash", async () => {
    const rows = await inRollback(db, (tx) => insertCrash(tx));
    expect(rows).toHaveLength(1);
  });

  it("rejects a negative death count", async () => {
    expect(await pgError(inRollback(db, (tx) => insertCrash(tx, { deaths: -1 })))).toBe(CHECK_VIOLATION);
  });

  it("rejects a date in the future", async () => {
    expect(await pgError(inRollback(db, (tx) => insertCrash(tx, { occurredOn: "2099-01-01" })))).toBe(CHECK_VIOLATION);
  });

  it("rejects the same news link twice", async () => {
    const code = await pgError(
      inRollback(db, async (tx) => {
        await tx.execute(q`insert into sources (kind, url, normalized_url) values ('news', 'https://example.com/a', 'example.com/a')`);
        await tx.execute(q`insert into sources (kind, url, normalized_url) values ('news', 'https://example.com/a?x', 'example.com/a')`);
      }),
    );
    expect(code).toBe(UNIQUE_VIOLATION);
  });

  it("rejects a submission needing 3 approvals", async () => {
    const code = await pgError(
      inRollback(db, (tx) => tx.execute(q`insert into submissions (kind, target_type, payload, via, required_approvals) values ('new_crash', 'crash', '{}', 'web', 3)`)),
    );
    expect(code).toBe(CHECK_VIOLATION);
  });
});

describe("audit log is append-only for the website (SPEC 12.3)", () => {
  it("lets the website add an audit row", async () => {
    const rows = await inRollback(db, (tx) => tx.execute(q`insert into audit_log (action, target_type) values ('test', 'crash') returning id`));
    expect(rows).toHaveLength(1);
  });

  it("refuses to change or delete audit rows", async () => {
    expect(await pgError(inRollback(db, (tx) => tx.execute(q`update audit_log set action = 'changed'`)))).toBe(PERMISSION_DENIED);
    expect(await pgError(inRollback(db, (tx) => tx.execute(q`delete from audit_log`)))).toBe(PERMISSION_DENIED);
  });

  it("refuses to change the schema", async () => {
    expect(await pgError(inRollback(db, (tx) => tx.execute(q`create table t (x int)`)))).toBe(PERMISSION_DENIED);
  });
});
