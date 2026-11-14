import { and, eq, sql } from "drizzle-orm";
import { sessions, users } from "../schema";
import { defineQuery } from "./define";

/**
 * Accounts and staff checks (ADR 0006). Better Auth's own sign-in queries are not here; they run
 * through lib/db/auth-adapter.ts on the sign-in tables only.
 */

const EXAMPLE_ID = "0199c8a0-0000-7000-8000-00000000000a";
type Role = "contributor" | "trusted" | "reviewer" | "admin";

export const markStaffCheckPassed = defineQuery({
  name: "users/mark-staff-check",
  description:
    "Records that this session just passed the authenticator-app check, which unlocks reviewer and\nadmin powers for 12 hours (lib/auth/actor.ts). By token, because confirming the first code\nreplaces the session. Scoped to the session's own user.",
  example: { sessionToken: "example-session-token", userId: EXAMPLE_ID },
  build: (db, a: { sessionToken: string; userId: string }) =>
    db.update(sessions).set({ twoFactorVerifiedAt: sql`now()` })
      .where(and(eq(sessions.token, a.sessionToken), eq(sessions.userId, a.userId))).returning({ id: sessions.id }),
});

export const userByEmail = defineQuery({
  name: "users/by-email",
  description: "One account by email, for `pnpm users:role` (run on the server only).",
  example: { email: "someone@example.invalid" },
  build: (db, a: { email: string }) =>
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, twoFactorEnabled: users.twoFactorEnabled })
      .from(users).where(sql`lower(${users.email}) = lower(${a.email})`).limit(1),
});

export const setUserRole = defineQuery({
  name: "users/set-role",
  description:
    "Changes a user's role. Only the `migrator` database role may write this column (migration 0005),\nso this runs from `pnpm users:role` on the server, never from the website.",
  example: { userId: EXAMPLE_ID, role: "reviewer" as Role },
  build: (db, a: { userId: string; role: Role }) =>
    db.update(users).set({ role: a.role, updatedAt: sql`now()` }).where(eq(users.id, a.userId)).returning({ id: users.id }),
});

export const endUserSessions = defineQuery({
  name: "users/end-sessions",
  description: "Signs a user out everywhere, after their role changes, so the new role applies at once.",
  example: { userId: EXAMPLE_ID },
  build: (db, a: { userId: string }) => db.delete(sessions).where(eq(sessions.userId, a.userId)),
});

// --- Accounts page (/admin/users; ADR 0006) ---------------------------------------------------

export const listAccounts = defineQuery({
  name: "users/list",
  description:
    "One page of accounts for /admin/users, newest first, with each account's last activity (its\nlatest session) and the total for the pager. Shows email to staff only; never exported.",
  example: { limit: 25, offset: 0 },
  build: (db, a: { limit: number; offset: number }) =>
    db.select({
      id: users.id, name: users.name, email: users.email, image: users.image, role: users.role,
      twoFactorEnabled: users.twoFactorEnabled, bannedAt: users.bannedAt, banReason: users.banReason, createdAt: users.createdAt,
      // Qualified by hand: Drizzle drops the table name inside a subquery, which made "id" mean sessions.id.
      lastSeen: sql<string | null>`(select max(s.updated_at) from sessions s where s.user_id = "users"."id")`,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    }).from(users).orderBy(sql`${users.createdAt} desc`, sql`${users.id} desc`).limit(a.limit).offset(a.offset),
});

export const accountById = defineQuery({
  name: "users/by-id",
  description: "A target account's id and role, so an action can check the rules before asking the database.",
  example: { id: EXAMPLE_ID },
  build: (db, a: { id: string }) => db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, a.id)).limit(1),
});

export const staffSetRole = defineQuery({
  name: "users/staff-set-role",
  description:
    "Calls staff_set_role (migration 0007): an admin moves an account between contributor and reviewer.\nThe database re-checks every rule, ends the person's sessions and writes the audit log.",
  example: { actorId: EXAMPLE_ID, targetId: EXAMPLE_ID, role: "reviewer" as "contributor" | "reviewer" },
  build: (db, a: { actorId: string; targetId: string; role: "contributor" | "reviewer" }) =>
    db.execute(sql`select staff_set_role(${a.actorId}::uuid, ${a.targetId}::uuid, ${a.role}::user_role)`),
});

export const staffSetBan = defineQuery({
  name: "users/staff-set-ban",
  description:
    "Calls staff_set_ban (migration 0007): a reviewer or admin deactivates or reactivates an account.\nThe database re-checks every rule, ends the person's sessions on deactivation and writes the audit log.",
  example: { actorId: EXAMPLE_ID, targetId: EXAMPLE_ID, ban: true, reason: "Spam reports" },
  build: (db, a: { actorId: string; targetId: string; ban: boolean; reason: string }) =>
    db.execute(sql`select staff_set_ban(${a.actorId}::uuid, ${a.targetId}::uuid, ${a.ban}, ${a.reason})`),
});
