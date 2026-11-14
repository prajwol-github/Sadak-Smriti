import { describe, expect, it } from "vitest";
import { can, canChangeRole, canDeactivate, type Actor, type Role } from "./can";

const actor = (role: Role, extra: Partial<Actor> = {}): Actor => ({ id: `${role}-me`, role, twoFactorEnabled: true, guardianOf: [], ...extra });
const target = (role: Role, id = `${role}-them`) => ({ id, role });
const allowed = (d: { kind: string }) => d.kind === "allow";

describe("seeing accounts", () => {
  it.each([["contributor", false], ["trusted", false], ["reviewer", true], ["admin", true]] as const)("%s → %s", (role, ok) => {
    expect(allowed(can(actor(role), "view_accounts"))).toBe(ok);
  });
  it("a visitor cannot", () => expect(allowed(can(null, "view_accounts"))).toBe(false));
  it("staff without the code cannot", () => expect(allowed(can(actor("admin", { twoFactorEnabled: false }), "view_accounts"))).toBe(false));
});

describe("changing a role", () => {
  it("an admin moves a contributor to reviewer and back", () => {
    expect(allowed(canChangeRole(actor("admin"), target("contributor"), "reviewer"))).toBe(true);
    expect(allowed(canChangeRole(actor("admin"), target("reviewer"), "contributor"))).toBe(true);
  });
  it("nobody becomes an admin from the website", () => {
    expect(allowed(canChangeRole(actor("admin"), target("contributor"), "admin"))).toBe(false);
    expect(allowed(canChangeRole(actor("admin"), target("reviewer"), "admin"))).toBe(false);
  });
  it("an admin cannot be demoted from the website", () => {
    expect(allowed(canChangeRole(actor("admin"), target("admin"), "contributor"))).toBe(false);
  });
  it("trusted accounts are left to the server", () => {
    expect(allowed(canChangeRole(actor("admin"), target("trusted"), "reviewer"))).toBe(false);
  });
  it("an admin cannot change their own role", () => {
    expect(allowed(canChangeRole(actor("admin"), { id: "admin-me", role: "reviewer" }, "contributor"))).toBe(false);
  });
  it("a no-op change is refused", () => {
    expect(allowed(canChangeRole(actor("admin"), target("reviewer"), "reviewer"))).toBe(false);
  });
  it("a reviewer cannot change roles at all", () => {
    expect(allowed(canChangeRole(actor("reviewer"), target("contributor"), "reviewer"))).toBe(false);
  });
  it("an admin whose code check has lapsed cannot", () => {
    expect(allowed(canChangeRole(actor("admin", { twoFactorEnabled: false }), target("contributor"), "reviewer"))).toBe(false);
  });
});

describe("deactivating", () => {
  it("a reviewer deactivates contributors only", () => {
    expect(allowed(canDeactivate(actor("reviewer"), target("contributor")))).toBe(true);
    expect(allowed(canDeactivate(actor("reviewer"), target("trusted")))).toBe(true);
    expect(allowed(canDeactivate(actor("reviewer"), target("reviewer")))).toBe(false);
    expect(allowed(canDeactivate(actor("reviewer"), target("admin")))).toBe(false);
  });
  it("an admin deactivates contributors and reviewers, never an admin", () => {
    expect(allowed(canDeactivate(actor("admin"), target("contributor")))).toBe(true);
    expect(allowed(canDeactivate(actor("admin"), target("reviewer")))).toBe(true);
    expect(allowed(canDeactivate(actor("admin"), target("admin")))).toBe(false);
  });
  it("nobody deactivates themselves", () => {
    expect(allowed(canDeactivate(actor("admin"), { id: "admin-me", role: "reviewer" }))).toBe(false);
    expect(allowed(canDeactivate(actor("reviewer"), { id: "reviewer-me", role: "contributor" }))).toBe(false);
  });
  it("a contributor and a visitor cannot", () => {
    expect(allowed(canDeactivate(actor("contributor"), target("contributor")))).toBe(false);
    expect(allowed(canDeactivate(null, target("contributor")))).toBe(false);
  });
  it("a banned reviewer cannot", () => {
    expect(allowed(canDeactivate(actor("reviewer", { bannedAt: new Date() }), target("contributor")))).toBe(false);
  });
});
