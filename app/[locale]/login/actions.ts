"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleSignInConfigured } from "@/lib/auth/server";
import { currentActor } from "@/lib/auth/session";
import { routing } from "@/lib/i18n/routing";
import { can } from "@/lib/policy/can";

/**
 * Starting and ending the caller's own sign-in (ADR 0006). Public by design: signing in only ever
 * creates or opens the caller's own account, as a contributor.
 */

function localeOf(fd: FormData): string {
  const v = fd.get("locale");
  return typeof v === "string" && (routing.locales as readonly string[]).includes(v) ? v : routing.defaultLocale;
}

export async function signInWithGoogle(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  if (can(null, "read_public").kind !== "allow" || !googleSignInConfigured()) redirect(`/${locale}/login?error=config`);

  const res = await auth().api.signInSocial({
    body: { provider: "google", callbackURL: `/${locale}/account`, errorCallbackURL: `/${locale}/login?error=failed` },
    headers: await headers(),
  });
  // Only ever Google's own address, built by Better Auth from the configured client.
  if (!res.url?.startsWith("https://accounts.google.com/")) redirect(`/${locale}/login?error=failed`);
  redirect(res.url);
}

export async function signOut(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  if (can(await currentActor(), "read_public").kind === "allow") {
    await auth().api.signOut({ headers: await headers() });
  }
  redirect(`/${locale}`);
}
