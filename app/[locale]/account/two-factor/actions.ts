"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import * as z from "zod";
import { isStaffRole, roleOf } from "@/lib/auth/actor";
import { auth } from "@/lib/auth/server";
import { readSession } from "@/lib/auth/session";
import type { TwoFactorState } from "@/lib/auth/two-factor-state";
import { insertAudit } from "@/lib/db/queries/reports";
import { transaction } from "@/lib/db/queries/run";
import { markStaffCheckPassed } from "@/lib/db/queries/users";
import { routing } from "@/lib/i18n/routing";
import { hitStaffCodeLimit } from "@/lib/net/rate-limit";

/**
 * The staff code check itself (ADR 0006). The policy cannot decide this: can() withholds reviewer
 * and admin powers until this succeeds. So each action checks the role directly and refuses
 * anyone who is not a signed-in, unbanned reviewer or admin.
 */

async function staffSession() {
  const s = await readSession();
  if (!s || s.user.bannedAt || !isStaffRole(roleOf(s.user.role))) return null;
  return s;
}

function localeOf(fd: FormData): string {
  const v = fd.get("locale");
  return typeof v === "string" && (routing.locales as readonly string[]).includes(v) ? v : routing.defaultLocale;
}

/** Creates (or replaces an unfinished) authenticator secret and returns what the app needs. */
export async function startSetup(): Promise<TwoFactorState> {
  const s = await staffSession();
  if (!s) return { step: "start", error: "error" };
  if (s.user.twoFactorEnabled) return { step: "code" };
  try {
    const res = await auth().api.enableTwoFactor({ body: { method: "totp" }, headers: await headers() });
    if (res.method !== "totp") return { step: "start", error: "error" };
    const secret = new URL(res.totpURI).searchParams.get("secret") ?? "";
    const { modules } = QRCode.create(res.totpURI, { errorCorrectionLevel: "M" });
    const qr = Array.from({ length: modules.size }, (_, r) =>
      Array.from({ length: modules.size }, (_, c) => (modules.get(r, c) ? "1" : "0")).join(""),
    );
    return { step: "scan", qr, secret, backupCodes: res.backupCodes };
  } catch {
    return { step: "start", error: "error" };
  }
}

const Code = z.string().regex(/^\d{6}$/);

/** Checks a code; on success unlocks staff powers for this session and opens the review area. */
export async function confirmCode(prev: TwoFactorState, fd: FormData): Promise<TwoFactorState> {
  const s = await staffSession();
  if (!s) return { ...prev, error: "error" };
  const locale = localeOf(fd);

  // Counted before checking, right or wrong (Better Auth doesn't limit this path; see rate-limit.ts).
  const limit = await transaction((tx) => hitStaffCodeLimit(tx, s.user.id));
  if (!limit.ok) return { ...prev, error: "locked" };

  const code = Code.safeParse(String(fd.get("code") ?? "").replace(/\s/g, ""));
  if (!code.success) return { ...prev, error: "wrong" };

  let sessionToken = s.session.token;
  try {
    const res = await auth().api.verifyTOTP({ body: { code: code.data }, headers: await headers(), returnHeaders: true });
    // Confirming the first code replaces the session (Better Auth); stamp the new one.
    const cookieName = (await auth().$context).authCookies.sessionToken.name;
    for (const c of res.headers.getSetCookie()) {
      if (!c.startsWith(`${cookieName}=`)) continue;
      const value = decodeURIComponent(c.slice(cookieName.length + 1).split(";")[0]);
      if (value) sessionToken = value.split(".")[0];
    }
  } catch (e) {
    const status = (e as { status?: string }).status;
    return { ...prev, error: status === "UNAUTHORIZED" || status === "BAD_REQUEST" ? "wrong" : "error" };
  }

  await transaction(async (tx) => {
    await markStaffCheckPassed.build(tx, { sessionToken, userId: s.user.id });
    await insertAudit.build(tx, {
      actorId: s.user.id, action: "user.staff_code_confirmed", targetType: "user", targetId: s.user.id,
      after: { firstTime: !s.user.twoFactorEnabled }, ipHash: null,
    });
  });
  redirect(`/${locale}/review`);
}
