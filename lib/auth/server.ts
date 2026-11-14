import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { authAdapter } from "@/lib/db/auth-adapter";
import { withHashedIp } from "./session-privacy";

/**
 * Sign-in (SPEC 4; ADR 0006): Google only, through Better Auth.
 *
 * - Everyone who signs in is a contributor. Roles are set only on the server (`pnpm users:role`),
 *   and the database refuses any role write from the website (migration 0005).
 * - Reviewers and admins also confirm an authenticator-app code once per session before using
 *   their powers (lib/auth/actor.ts). Better Auth's two-factor plugin stores the secret and checks
 *   codes; it does not challenge Google sign-ins by itself, so the check is ours.
 *
 * Created on first use, not at import, so `next build` does not need the secrets.
 */
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || !baseURL) {
    throw new Error("Sign-in is not configured: set BETTER_AUTH_SECRET and BETTER_AUTH_URL (see .env.example)");
  }
  const google = googleCredentials();

  return betterAuth({
    appName: "Sadak Smriti",
    secret,
    baseURL,
    basePath: "/api/auth",
    database: authAdapter(),
    // Google only (owner's decision, 14 Nov 2026). No passwords are stored.
    emailAndPassword: { enabled: false },
    // Without Google keys (a fresh checkout) the site still runs; the sign-in button says so.
    socialProviders: google ? { google } : {},
    user: {
      // input: false — never taken from a request. No default here: the database fills
      // 'contributor', and the website's database role cannot write this column at all.
      additionalFields: {
        role: { type: "string", required: false, input: false },
        bannedAt: { type: "date", required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days, refreshed daily while in use
      updateAge: 60 * 60 * 24,
      additionalFields: {
        twoFactorVerifiedAt: { type: "date", required: false, input: false },
      },
    },
    // The Google tokens are never used after sign-in; keep them encrypted at rest (audit finding 6).
    account: { encryptOAuthTokens: true },
    // Sessions keep a hash of the address, not the address (SPEC 12.3; audit finding 6).
    databaseHooks: {
      session: {
        create: { before: async (s) => ({ data: withHashedIp(s) }) },
        update: { before: async (s) => ({ data: withHashedIp(s) }) },
      },
    },
    advanced: {
      // Ids come from the database's uuidv7() default, like every other table.
      database: { generateId: false },
      useSecureCookies: baseURL.startsWith("https://"),
      // Behind Cloudflare the visitor's address is CF-Connecting-IP; port 443 accepts Cloudflare only
      // (docs/runbooks/deploy.md). Elsewhere (development) Better Auth's default applies.
      ...(process.env.NODE_ENV === "production" ? { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } } : {}),
    },
    telemetry: { enabled: false },
    plugins: [
      twoFactor({ issuer: "Sadak Smriti", allowPasswordless: true }),
      nextCookies(), // must stay last (Better Auth docs)
    ],
  });
}

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Whether "Continue with Google" can work on this server. */
export function googleSignInConfigured(): boolean {
  return googleCredentials() !== null;
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __sadakAuth?: Auth };

export function auth(): Auth {
  g.__sadakAuth ??= createAuth();
  return g.__sadakAuth;
}
