/**
 * The only place permissions are decided (SPEC 4, 12.2; PLAN P0-09).
 *
 * Every server action and API route calls `can()` before doing anything. The matrix below is
 * SPEC 4.2 written as data; `matrix.test.ts` checks every cell against an independent copy.
 */

export type Role = "contributor" | "trusted" | "reviewer" | "admin";

/** A signed-in user, as far as permissions care. `null` means a visitor. */
export interface Actor {
  id: string;
  role: Role;
  /** Reviewers and admins must have two-factor login before using those powers (SPEC 4.1). */
  twoFactorEnabled: boolean;
  /** Ids of people this user is an approved guardian of (SPEC 7.6). */
  guardianOf: readonly string[];
  bannedAt?: Date | null;
}

export type Action =
  | "read_public"
  | "submit_tip"
  | "report_content"
  | "create_crash"
  | "add_news_link"
  | "edit_crash"
  | "add_person"
  | "edit_person"
  | "edit_memorial"
  | "upload_photo"
  | "hide_memorial"
  | "hide_injured_name"
  | "merge"
  | "delete"
  | "approve_family_claim"
  | "review_news"
  | "run_pipeline"
  | "review_submissions"
  | "view_accounts"
  | "manage_roles"
  | "deactivate_user"
  | "manage_site";

/** What the action needs to know about its target. Only person-scoped actions use it today. */
export interface Resource {
  /** The person the action is about, for guardian rights. */
  personId?: string;
}

/**
 * The outcome of a permission check.
 * - `allow`: do it now. `postModerated` means it goes live and appears in "Recent changes".
 * - `review`: create a submission instead; it needs `approvals` reviewer approvals.
 * - `deny`: refuse.
 */
export type Decision =
  | { kind: "allow"; captcha?: true; reasonRequired?: true; postModerated?: true }
  | { kind: "review"; approvals: 1 | 2; needsOtherReviewer?: true; captcha?: true }
  | { kind: "deny"; reason: DenyReason };

export type DenyReason = "not_permitted" | "login_required" | "banned" | "two_factor_required";

type Column = "visitor" | "contributor" | "trusted" | "guardian" | "reviewer" | "admin";
type Cell = Decision | null; // null = blank in the spec: no right from this column

const allow: Decision = { kind: "allow" };
const captcha: Decision = { kind: "allow", captcha: true };
const review1: Decision = { kind: "review", approvals: 1 };
const review2: Decision = { kind: "review", approvals: 2 };
const postModerated: Decision = { kind: "allow", postModerated: true };

/** SPEC 4.2, row by row. Columns: visitor, contributor, trusted, guardian (own person), reviewer, admin. */
const MATRIX: Record<Action, Record<Column, Cell>> = {
  read_public:          { visitor: allow,   contributor: allow,   trusted: allow,   guardian: allow,         reviewer: allow,   admin: allow },
  submit_tip:           { visitor: captcha, contributor: allow,   trusted: allow,   guardian: allow,         reviewer: allow,   admin: allow },
  report_content:       { visitor: captcha, contributor: allow,   trusted: allow,   guardian: allow,         reviewer: allow,   admin: allow },
  // Visitors may report a crash with the short form (ADR 0004): captcha and limits, always reviewed.
  // A report whose only source is the reporter needs 2 approvals; the workflow raises it (SPEC 7.4).
  // Staff publish directly, logged with full history and a one-click revert (owner's decision, 14 Nov 2026).
  create_crash:         { visitor: { kind: "review", approvals: 1, captcha: true }, contributor: review1, trusted: review1, guardian: null,          reviewer: postModerated, admin: postModerated },
  add_news_link:        { visitor: null,    contributor: review1, trusted: allow,   guardian: null,          reviewer: allow,   admin: allow },
  edit_crash:           { visitor: null,    contributor: review1, trusted: review1, guardian: null,          reviewer: { kind: "allow", reasonRequired: true }, admin: allow },
  add_person:           { visitor: null,    contributor: review1, trusted: review1, guardian: null,          reviewer: postModerated, admin: postModerated },
  // Facts about a person (name, age, status, ...). Their memorial text and photos are edit_memorial.
  edit_person:          { visitor: null,    contributor: review1, trusted: review1, guardian: null,          reviewer: { kind: "allow", reasonRequired: true }, admin: allow },
  edit_memorial:        { visitor: null,    contributor: review1, trusted: review1, guardian: postModerated, reviewer: allow,   admin: allow },
  upload_photo:         { visitor: null,    contributor: review1, trusted: review1, guardian: postModerated, reviewer: allow,   admin: allow },
  hide_memorial:        { visitor: null,    contributor: null,    trusted: null,    guardian: allow,         reviewer: review2, admin: allow },
  // "→ review (person or family)" for contributors; trusted contributors keep contributor rights.
  hide_injured_name:    { visitor: null,    contributor: review1, trusted: review1, guardian: allow,         reviewer: allow,   admin: allow },
  // Contributors may propose a merge; carrying it out always takes 2 approvals.
  merge:                { visitor: null,    contributor: review2, trusted: review2, guardian: null,          reviewer: review2, admin: allow },
  delete:               { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: review2, admin: allow },
  approve_family_claim: { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: review2, admin: allow },
  // The news queue: candidates from the worker, and the "Run now" button (SPEC 7.2, ADR 0007).
  review_news:          { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: allow,   admin: allow },
  run_pipeline:         { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: allow,   admin: allow },
  // Accounts (SPEC 4.1; ADR 0006). Which accounts, and which changes, is canChangeRole / canDeactivate below.
  // Deciding on submissions; who may decide a particular one (not their own, not twice) is canDecide.
  review_submissions:   { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: allow,   admin: allow },
  view_accounts:        { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: allow,   admin: allow },
  manage_roles:         { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: null,    admin: allow },
  deactivate_user:      { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: allow,   admin: allow },
  manage_site:          { visitor: null,    contributor: null,    trusted: null,    guardian: null,          reviewer: null,    admin: allow },
};

/** Actions that use reviewer or admin powers and therefore need two-factor login. */
const ELEVATED_ROLES: readonly Role[] = ["reviewer", "admin"];

/** Higher is more permissive. Used to combine a role's column with the guardian column. */
function rank(d: Cell): number {
  if (!d) return 0;
  if (d.kind === "deny") return 0;
  if (d.kind === "review") return d.approvals === 2 ? 1 : 2;
  return 3;
}

/**
 * Roles are cumulative: a trusted contributor has every contributor right, and so on.
 * A blank cell in a higher column therefore falls back to the column below it.
 */
const INHERITS: Record<Role, Column[]> = {
  contributor: ["contributor"],
  trusted: ["trusted", "contributor"],
  reviewer: ["reviewer", "contributor"],
  admin: ["admin", "contributor"],
};

function best(cells: Cell[]): Cell {
  return cells.reduce<Cell>((acc, c) => (rank(c) > rank(acc) ? c : acc), null);
}

export function can(actor: Actor | null, action: Action, resource: Resource = {}): Decision {
  const row = MATRIX[action];

  if (!actor) {
    return row.visitor ?? { kind: "deny", reason: "login_required" };
  }
  if (actor.bannedAt) {
    // A banned user keeps only what a visitor has.
    return action === "read_public" ? allow : { kind: "deny", reason: "banned" };
  }

  // A reviewer or admin without two-factor gets contributor rights only, until they set it up.
  const elevated = ELEVATED_ROLES.includes(actor.role);
  const effectiveRole: Role = elevated && !actor.twoFactorEnabled ? "contributor" : actor.role;

  const cells = INHERITS[effectiveRole].map((col) => row[col]);
  if (resource.personId && actor.guardianOf.includes(resource.personId)) {
    cells.push(row.guardian);
  }
  const decision = best(cells);
  if (decision) return decision;

  if (elevated && !actor.twoFactorEnabled && (row.reviewer || row.admin)) {
    return { kind: "deny", reason: "two_factor_required" };
  }
  return { kind: "deny", reason: "not_permitted" };
}

// ---------------------------------------------------------------------------
// Reviewing a submission (SPEC 4.1 hard rules, 7.4)
// ---------------------------------------------------------------------------

export interface SubmissionForReview {
  /** null for tips and the news pipeline */
  submittedBy: string | null;
  /** Reviewers who have already approved it. */
  approvedBy: readonly string[];
}

/**
 * Whether this actor may approve or reject a submission:
 * - only reviewers and admins, with two-factor login;
 * - never their own submission;
 * - never twice: the second of two approvals must come from a different reviewer.
 */
export function canDecide(actor: Actor | null, submission: SubmissionForReview): Decision {
  if (!actor) return { kind: "deny", reason: "login_required" };
  if (actor.bannedAt) return { kind: "deny", reason: "banned" };
  if (!ELEVATED_ROLES.includes(actor.role)) return { kind: "deny", reason: "not_permitted" };
  if (!actor.twoFactorEnabled) return { kind: "deny", reason: "two_factor_required" };
  if (submission.submittedBy === actor.id) return { kind: "deny", reason: "not_permitted" };
  if (submission.approvedBy.includes(actor.id)) return { kind: "deny", reason: "not_permitted" };
  return allow;
}

// ---------------------------------------------------------------------------
// Managing accounts (SPEC 4.1; ADR 0006). The database enforces the same rules in
// staff_set_role and staff_set_ban (migration 0007); these decide what the page offers and
// what an action attempts.
// ---------------------------------------------------------------------------

export interface AccountTarget {
  id: string;
  role: Role;
}

/**
 * Only an admin changes roles, only between contributor and reviewer, and never their own.
 * Making an admin is `pnpm users:role` on the server, not the website.
 */
export function canChangeRole(actor: Actor | null, target: AccountTarget, newRole: Role): Decision {
  const base = can(actor, "manage_roles");
  if (base.kind === "deny") return base;
  if (target.id === actor?.id) return { kind: "deny", reason: "not_permitted" };
  const movable = (r: Role) => r === "contributor" || r === "reviewer";
  if (!movable(target.role) || !movable(newRole) || target.role === newRole) return { kind: "deny", reason: "not_permitted" };
  return allow;
}

/**
 * A reviewer or admin may deactivate (and reactivate) a contributor; an admin also a reviewer.
 * Nobody deactivates an admin or themselves from the website.
 */
export function canDeactivate(actor: Actor | null, target: AccountTarget): Decision {
  const base = can(actor, "deactivate_user");
  if (base.kind === "deny") return base;
  if (target.id === actor?.id || target.role === "admin") return { kind: "deny", reason: "not_permitted" };
  if (actor?.role === "reviewer" && target.role !== "contributor" && target.role !== "trusted") {
    return { kind: "deny", reason: "not_permitted" };
  }
  return allow;
}
