import { afterAll, describe, expect, it } from "vitest";
import { sql as q } from "drizzle-orm";
import { inRollback, pgError, testDb } from "@/lib/db/test-db";
import { runRetention } from "./retention";

/**
 * SPEC 12.3 promises, against the real database as role `app` (rolled back): a reporter's contact is
 * deleted 30 days after the decision, IP hashes and flood counters after 30 days (audit finding 5).
 */
const { db, end } = testDb();
afterAll(() => end());

const insertSub = (tx: Parameters<Parameters<typeof inRollback>[1]>[0], over: { contact?: string | null; purgeAfter?: string | null; ageDays?: number; ip?: string | null }) =>
  tx.execute<{ id: string }>(q`
    insert into submissions (kind, target_type, payload, via, contact_encrypted, contact_purge_after, ip_hash, created_at)
    values ('new_crash', 'crash', '{}'::jsonb, 'web', ${over.contact ?? null},
      ${over.purgeAfter ? q`now() + ${over.purgeAfter}::interval` : null}, ${over.ip ?? null}, now() - ${`${over.ageDays ?? 0} days`}::interval)
    returning id`);

describe("runRetention", () => {
  it("deletes contacts past their date, keeps the ones not yet due and the ones with no decision", async () => {
    const out = await inRollback(db, async (tx) => {
      const [due] = await insertSub(tx, { contact: "v1.x.y.z", purgeAfter: "-1 day" });
      const [notYet] = await insertSub(tx, { contact: "v1.x.y.z", purgeAfter: "10 days" });
      const [undecided] = await insertSub(tx, { contact: "v1.x.y.z", purgeAfter: null });
      const result = await runRetention(tx);
      const left = async (id: string) => (await tx.execute<{ c: string | null }>(q`select contact_encrypted as c from submissions where id = ${id}`))[0].c;
      return { result, due: await left(due.id), notYet: await left(notYet.id), undecided: await left(undecided.id) };
    });
    expect(out.due).toBeNull();
    expect(out.notYet).not.toBeNull();
    expect(out.undecided).not.toBeNull();
    expect(out.result.contacts).toBeGreaterThanOrEqual(1);
  });

  it("blanks IP hashes older than 30 days on submissions and on the audit log, and only those", async () => {
    const out = await inRollback(db, async (tx) => {
      const [oldSub] = await insertSub(tx, { ip: "hash-old", ageDays: 31 });
      const [newSub] = await insertSub(tx, { ip: "hash-new", ageDays: 1 });
      await tx.execute(q`insert into audit_log (action, target_type, ip_hash, at) values ('test.old', 'test', 'hash-old', now() - interval '31 days')`);
      await tx.execute(q`insert into audit_log (action, target_type, ip_hash, at) values ('test.new', 'test', 'hash-new', now() - interval '1 day')`);
      await runRetention(tx);
      const sub = async (id: string) => (await tx.execute<{ h: string | null }>(q`select ip_hash as h from submissions where id = ${id}`))[0].h;
      const audit = async (a: string) => (await tx.execute<{ h: string | null; action: string }>(q`select ip_hash as h, action from audit_log where action = ${a}`))[0];
      return { oldSub: await sub(oldSub.id), newSub: await sub(newSub.id), oldAudit: await audit("test.old"), newAudit: await audit("test.new") };
    });
    expect(out.oldSub).toBeNull();
    expect(out.newSub).toBe("hash-new");
    expect(out.oldAudit).toMatchObject({ h: null, action: "test.old" }); // the row stays, only the hash goes
    expect(out.newAudit.h).toBe("hash-new");
  });

  it("removes flood counters older than 30 days", async () => {
    const out = await inRollback(db, async (tx) => {
      await tx.execute(q`insert into rate_limits (key, window_start, count) values ('t:old', now() - interval '40 days', 1), ('t:new', now(), 1)`);
      const r = await runRetention(tx);
      const keys = (await tx.execute<{ key: string }>(q`select key from rate_limits where key like 't:%'`)).map((k) => k.key);
      return { r, keys };
    });
    expect(out.keys).toEqual(["t:new"]);
    expect(out.r.rateLimitRows).toBeGreaterThanOrEqual(1);
  });

  it("the website still cannot rewrite or delete audit rows directly; only the function blanks a hash", async () => {
    // One transaction per statement: a failed statement aborts its transaction.
    const attempt = (statement: ReturnType<typeof q>) =>
      inRollback(db, async (tx) => {
        await tx.execute(q`insert into audit_log (action, target_type, ip_hash, at) values ('test.direct', 'test', 'h', now() - interval '31 days')`);
        return pgError(tx.execute(statement));
      });
    expect(await attempt(q`update audit_log set action = 'changed' where action = 'test.direct'`)).toBe("42501");
    expect(await attempt(q`delete from audit_log where action = 'test.direct'`)).toBe("42501");
  });
});
