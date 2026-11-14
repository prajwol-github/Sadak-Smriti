import { describe, expect, it } from "vitest";
import { can } from "@/lib/policy/can";
import { STAFF_CHECK_MAX_AGE_MS, roleOf, staffCheckPassed, toActor, type SessionLike } from "./actor";

const NOW = new Date("2026-11-14T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function session(role: string, opts: { twoFactor?: boolean; verifiedAt?: Date | null; bannedAt?: Date | null } = {}): SessionLike {
  return {
    user: { id: "user-1", role, twoFactorEnabled: opts.twoFactor ?? false, bannedAt: opts.bannedAt ?? null },
    session: { twoFactorVerifiedAt: opts.verifiedAt ?? null },
  };
}

describe("roleOf", () => {
  it.each(["contributor", "trusted", "reviewer", "admin"])("keeps %s", (r) => expect(roleOf(r)).toBe(r));
  it.each([undefined, null, "", "Admin", "superuser", 1])("reads %j as contributor", (r) => expect(roleOf(r)).toBe("contributor"));
});

describe("the staff check", () => {
  it("passes right after the code was entered", () => {
    expect(staffCheckPassed(session("admin", { twoFactor: true, verifiedAt: ago(60_000) }), NOW)).toBe(true);
  });
  it("fails without an authenticator app, even with a timestamp", () => {
    expect(staffCheckPassed(session("admin", { twoFactor: false, verifiedAt: ago(60_000) }), NOW)).toBe(false);
  });
  it("fails when this session never entered a code", () => {
    expect(staffCheckPassed(session("admin", { twoFactor: true, verifiedAt: null }), NOW)).toBe(false);
  });
  it("expires after 12 hours", () => {
    expect(staffCheckPassed(session("admin", { twoFactor: true, verifiedAt: ago(STAFF_CHECK_MAX_AGE_MS) }), NOW)).toBe(false);
  });
  it("rejects a timestamp in the future", () => {
    expect(staffCheckPassed(session("admin", { twoFactor: true, verifiedAt: ago(-60_000) }), NOW)).toBe(false);
  });
});

describe("what a session may do", () => {
  it("a Google sign-in alone is a contributor", () => {
    expect(can(toActor(session("contributor"), NOW), "review_news").kind).toBe("deny");
  });
  it("an admin who has not entered a code cannot use the news queue", () => {
    const d = can(toActor(session("admin", { twoFactor: true }), NOW), "review_news");
    expect(d).toEqual({ kind: "deny", reason: "two_factor_required" });
  });
  it("an admin who entered a code can", () => {
    expect(can(toActor(session("admin", { twoFactor: true, verifiedAt: ago(1000) }), NOW), "run_pipeline").kind).toBe("allow");
  });
  it("a banned reviewer cannot, even after the code", () => {
    const a = toActor(session("reviewer", { twoFactor: true, verifiedAt: ago(1000), bannedAt: ago(5000) }), NOW);
    expect(can(a, "review_news")).toEqual({ kind: "deny", reason: "banned" });
  });
});
