import "server-only";
import { headers } from "next/headers";
import type { Actor } from "@/lib/policy/can";
import { isStaffRole, roleOf, staffCheckPassed, toActor } from "./actor";
import { auth } from "./server";

/**
 * The signed-in user for this request (ADR 0006). Reads the request's cookies, so any page that
 * calls these must do it inside <Suspense> (Cache Components) and is never cached.
 */

export async function readSession() {
  return auth().api.getSession({ headers: await headers() });
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof readSession>>>;

/** The policy's view of the caller: null for a visitor. */
export async function currentActor(): Promise<Actor | null> {
  const s = await readSession();
  return s ? toActor(s) : null;
}

/**
 * Who may see the review area. Anyone who is not a reviewer or admin gets "none", and pages show
 * the ordinary not-found page, so the area looks the same as any address that doesn't exist.
 */
export type StaffAccess =
  | { kind: "none" }
  | { kind: "needs_code"; session: AuthSession }
  | { kind: "ok"; session: AuthSession; actor: Actor };

export async function staffAccess(): Promise<StaffAccess> {
  const s = await readSession();
  if (!s || s.user.bannedAt || !isStaffRole(roleOf(s.user.role))) return { kind: "none" };
  if (!staffCheckPassed(s)) return { kind: "needs_code", session: s };
  return { kind: "ok", session: s, actor: toActor(s) };
}
