import type { Actor, Role } from "@/lib/policy/can";

/**
 * Turns a Better Auth session into the policy's `Actor` (lib/policy/can.ts). Pure, so it is unit
 * tested; lib/auth/session.ts reads the session from the request and calls this.
 */

const ROLES: readonly Role[] = ["contributor", "trusted", "reviewer", "admin"];

/** How long one authenticator-app check unlocks staff powers. Then the code is asked again. */
export const STAFF_CHECK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SessionLike {
  user: { id: string; role?: unknown; twoFactorEnabled?: boolean | null; bannedAt?: Date | string | null };
  session: { twoFactorVerifiedAt?: Date | string | null };
}

export function isStaffRole(role: Role): boolean {
  return role === "reviewer" || role === "admin";
}

/** An unknown value in the role column never grants anything: it reads as "contributor". */
export function roleOf(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "contributor";
}

/**
 * Whether this session has passed the authenticator-app check recently enough. The policy calls
 * this `twoFactorEnabled`: without it a reviewer or admin has contributor rights only.
 */
export function staffCheckPassed(s: SessionLike, now: Date = new Date()): boolean {
  if (!s.user.twoFactorEnabled) return false;
  const at = s.session.twoFactorVerifiedAt;
  if (!at) return false;
  const age = now.getTime() - new Date(at).getTime();
  return age >= 0 && age < STAFF_CHECK_MAX_AGE_MS;
}

export function toActor(s: SessionLike, now: Date = new Date()): Actor {
  const banned = s.user.bannedAt ? new Date(s.user.bannedAt) : null;
  return {
    id: s.user.id,
    role: roleOf(s.user.role),
    twoFactorEnabled: staffCheckPassed(s, now),
    guardianOf: [], // family guardians come with SPEC 7.6 (P3)
    bannedAt: banned,
  };
}
