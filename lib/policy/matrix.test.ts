import { describe, expect, it } from "vitest";
import { can, canDecide, type Action, type Actor, type Decision, type Role } from "./can";

/**
 * SPEC 4.2, restated independently of can.ts so a mistake in one copy shows up as a failure.
 *
 * Codes:  A  allowed now          C  allowed with captcha      -  refused
 *         R1 to review, 1 approval R2 to review, 2 approvals    Ro to review by another reviewer
 *         R1c to review, with captcha (visitors' crash reports, ADR 0004)
 *         Ar allowed, reason logged                              Ap allowed now, post-moderated
 *
 * Columns: visitor, contributor, trusted, guardian of this person, reviewer, admin.
 * The guardian column is a contributor who guards the person the action is about.
 */
const SPEC_4_2: Record<Action, [string, string, string, string, string, string]> = {
  read_public:          ["A", "A",  "A",  "A",  "A",  "A"],
  submit_tip:           ["C", "A",  "A",  "A",  "A",  "A"],
  report_content:       ["C", "A",  "A",  "A",  "A",  "A"],
  create_crash:         ["R1c", "R1", "R1", "R1", "Ap", "Ap"],
  add_news_link:        ["-", "R1", "A",  "R1", "A",  "A"],
  edit_crash:           ["-", "R1", "R1", "R1", "Ar", "A"],
  add_person:           ["-", "R1", "R1", "R1", "Ap", "Ap"],
  edit_person:          ["-", "R1", "R1", "R1", "Ar", "A"],
  edit_memorial:        ["-", "R1", "R1", "Ap", "A",  "A"],
  upload_photo:         ["-", "R1", "R1", "Ap", "A",  "A"],
  hide_memorial:        ["-", "-",  "-",  "A",  "R2", "A"],
  hide_injured_name:    ["-", "R1", "R1", "A",  "A",  "A"],
  merge:                ["-", "R2", "R2", "R2", "R2", "A"],
  delete:               ["-", "-",  "-",  "-",  "R2", "A"],
  approve_family_claim: ["-", "-",  "-",  "-",  "R2", "A"],
  review_news:          ["-", "-",  "-",  "-",  "A",  "A"],
  run_pipeline:         ["-", "-",  "-",  "-",  "A",  "A"],
  review_submissions:   ["-", "-",  "-",  "-",  "A",  "A"],
  view_accounts:        ["-", "-",  "-",  "-",  "A",  "A"],
  manage_roles:         ["-", "-",  "-",  "-",  "-",  "A"],
  deactivate_user:      ["-", "-",  "-",  "-",  "A",  "A"],
  manage_site:          ["-", "-",  "-",  "-",  "-",  "A"],
};

function code(d: Decision): string {
  if (d.kind === "deny") return "-";
  if (d.kind === "review") return d.needsOtherReviewer ? "Ro" : `R${d.approvals}${d.captcha ? "c" : ""}`;
  if (d.captcha) return "C";
  if (d.reasonRequired) return "Ar";
  if (d.postModerated) return "Ap";
  return "A";
}

const PERSON = "person-1";
const OTHER_PERSON = "person-2";

function actor(role: Role, extra: Partial<Actor> = {}): Actor {
  return { id: `${role}-user`, role, twoFactorEnabled: true, guardianOf: [], ...extra };
}

const COLUMNS: [string, Actor | null][] = [
  ["visitor", null],
  ["contributor", actor("contributor")],
  ["trusted", actor("trusted")],
  ["guardian", actor("contributor", { id: "guardian-user", guardianOf: [PERSON] })],
  ["reviewer", actor("reviewer")],
  ["admin", actor("admin")],
];

describe("SPEC 4.2 permission matrix: every cell", () => {
  const cases = Object.entries(SPEC_4_2).flatMap(([action, row]) =>
    COLUMNS.map(([column, who], i) => [action as Action, column, who, row[i]] as const),
  );

  it.each(cases)("%s by %s → %s", (action, _column, who, expected) => {
    expect(code(can(who, action, { personId: PERSON }))).toBe(expected);
  });
});

describe("guardian rights are limited to their own person", () => {
  const guardian = actor("contributor", { guardianOf: [PERSON] });

  it("edits their own person's memorial immediately", () => {
    expect(code(can(guardian, "edit_memorial", { personId: PERSON }))).toBe("Ap");
    expect(code(can(guardian, "hide_memorial", { personId: PERSON }))).toBe("A");
  });

  it("has only contributor rights on anyone else's memorial", () => {
    expect(code(can(guardian, "edit_memorial", { personId: OTHER_PERSON }))).toBe("R1");
    expect(code(can(guardian, "hide_memorial", { personId: OTHER_PERSON }))).toBe("-");
  });

  it("gets no guardian rights when the action names no person", () => {
    expect(code(can(guardian, "hide_memorial"))).toBe("-");
  });
});

describe("two-factor login (SPEC 4.1)", () => {
  it("a reviewer without two-factor has only contributor rights", () => {
    const r = actor("reviewer", { twoFactorEnabled: false });
    expect(code(can(r, "add_news_link"))).toBe("R1");
    expect(code(can(r, "edit_crash"))).toBe("R1");
  });

  it("an admin without two-factor is told to set it up for admin-only actions", () => {
    const a = actor("admin", { twoFactorEnabled: false });
    expect(can(a, "manage_site")).toEqual({ kind: "deny", reason: "two_factor_required" });
    expect(can(a, "delete")).toEqual({ kind: "deny", reason: "two_factor_required" });
  });
});

describe("visitors and bans", () => {
  it("tells a visitor to log in for actions that need an account", () => {
    expect(can(null, "edit_crash")).toEqual({ kind: "deny", reason: "login_required" });
    expect(can(null, "add_person")).toEqual({ kind: "deny", reason: "login_required" });
  });

  it("lets a visitor report a crash, always to review and with a captcha (ADR 0004)", () => {
    expect(can(null, "create_crash")).toEqual({ kind: "review", approvals: 1, captcha: true });
  });

  it("a banned user can only read", () => {
    const banned = actor("admin", { bannedAt: new Date("2026-11-01") });
    expect(code(can(banned, "read_public"))).toBe("A");
    expect(can(banned, "submit_tip")).toEqual({ kind: "deny", reason: "banned" });
    expect(can(banned, "manage_site")).toEqual({ kind: "deny", reason: "banned" });
  });
});

describe("deciding on submissions (SPEC 4.1 hard rules)", () => {
  const reviewer = actor("reviewer", { id: "rev-a" });
  const second = actor("reviewer", { id: "rev-b" });

  it("a reviewer may decide on someone else's submission", () => {
    expect(canDecide(reviewer, { submittedBy: "someone", approvedBy: [] }).kind).toBe("allow");
    expect(canDecide(reviewer, { submittedBy: null, approvedBy: [] }).kind).toBe("allow");
  });

  it("a reviewer can never approve their own submission", () => {
    expect(canDecide(reviewer, { submittedBy: "rev-a", approvedBy: [] }).kind).toBe("deny");
  });

  it("one reviewer cannot give both approvals of a two-approval item", () => {
    expect(canDecide(reviewer, { submittedBy: "someone", approvedBy: ["rev-a"] }).kind).toBe("deny");
    expect(canDecide(second, { submittedBy: "someone", approvedBy: ["rev-a"] }).kind).toBe("allow");
  });

  it("contributors, trusted contributors and visitors cannot decide", () => {
    for (const who of [null, actor("contributor"), actor("trusted")]) {
      expect(canDecide(who, { submittedBy: "someone", approvedBy: [] }).kind).toBe("deny");
    }
  });

  it("a reviewer without two-factor cannot decide", () => {
    const r = actor("reviewer", { twoFactorEnabled: false });
    expect(canDecide(r, { submittedBy: "someone", approvedBy: [] })).toEqual({ kind: "deny", reason: "two_factor_required" });
  });
});
