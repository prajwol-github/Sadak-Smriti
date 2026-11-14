# 0006: Sign-in with Google, and how staff roles are kept safe

Date: 14 Nov 2026. Status: accepted (owner's decision).

## Context

The project is open source and community facing. The owner wanted login kept as simple as possible, while making sure nobody can make themselves an admin, and nobody can find out who the admins are. SPEC 2 and PLAN P0-08 planned Google sign-in plus email magic links, roles on the user, and two-factor login for reviewers and admins.

## Decision

- **Google sign-in only**, through Better Auth 1.7.22 (`lib/auth/server.ts`). No magic links and no passwords, so there is no email service to run yet and nothing to leak. Everyone who signs in is a **contributor**. Telemetry is switched off.
- **Roles live only in the database.** No reviewer's or admin's name or email is in the repository. A role is changed only with `pnpm users:role <email> <role>`, run on the server. Changing a role is written to `audit_log` and signs the person out.
- **The database enforces it.** The website's role (`app`) cannot update `users.role` (column grants, migration 0005), and a trigger refuses any new account it creates with a role other than `contributor` (migration 0006). Only `migrator` can change a role, and `pnpm users:role` connects as `migrator`. (0005 first tried column grants on insert too; that broke sign-up, because Drizzle names every column in an insert, writing `DEFAULT` for unset ones, and Postgres checks the privilege for every column named.) So even a bug in the website or a stolen website password cannot make anyone an admin. `lib/auth/auth.db.test.ts` checks this.
- **Staff confirm an authenticator-app code once per session**, valid for 12 hours. Better Auth's two-factor plugin stores the secret (encrypted) and checks codes. But it only challenges password sign-ins (`signInPaths` in the plugin), never a Google sign-in, so the check is ours:
  - the code is confirmed in `app/[locale]/account/two-factor/actions.ts`, which stamps `sessions.two_factor_verified_at`;
  - `lib/auth/actor.ts` gives the policy (`can()`) staff powers only when that stamp is less than 12 hours old;
  - the plugin replaces the session when the first code is confirmed, so the action stamps the new session, read from the response's cookie;
  - the plugin locks out wrong codes only during a password sign-in, so `hitStaffCodeLimit` allows 5 attempts per 15 minutes and 20 per day per account.
- **The review area looks like any missing page** to everyone who is not staff. Public pages never name reviewers. The code is public, so the existence of `/review` is not a secret. What is protected is who the staff are and what they can do.
- **Better Auth's own queries** run through `lib/db/auth-adapter.ts`, the one exception to ADR 0005, on the five sign-in tables only.
- Pages that read the session (`/account`, `/review`) do it inside `<Suspense>` and are never cached. The site header does not show the signed-in state, so every public page stays static; "Sign in" is in the footer.

## Managing accounts from the website (added 14 Nov 2026)

`/admin/users` lists every account (reviewers and admins only). The owner's limits:

- **Only an admin changes roles, and only between contributor and reviewer.** Making an admin stays `pnpm users:role` on the server. Nobody changes their own role.
- **A reviewer or admin deactivates (and reactivates) accounts.** A reviewer only contributors; an admin contributors and reviewers; nobody an admin or themselves.
- Both go through two SECURITY DEFINER database functions, `staff_set_role` and `staff_set_ban` (migration 0007). The functions re-check every rule, end the person's sessions, and write the audit log, so a bug in the website cannot break the rules. The website's role can no longer write `banned_at` or `ban_reason` directly.
- **What this weakens:** someone holding the website's database password *and* an admin's account id could now create reviewers (never admins) by calling `staff_set_role`. That is why the website stays unable to make admins. Whether the person at the keyboard passed the authenticator-app check is the website's job (`lib/auth/actor.ts`); the functions only check that the account has an authenticator app switched on.
- A deactivated user keeps read access, sees a notice on their account page, and the policy denies everything else (`bannedAt` in `can()`).
- Staff pages share `components/review/staff-nav.tsx` (News, Accounts, My account, Sign out). The public header still never reads the session.

## Consequences

- Making the first admin: the person signs in with Google once, then someone on the server runs `pnpm users:role their@email admin`. They set up the authenticator app the first time they open `/review`.
- A lost phone: a backup code works once. If those are lost too, an admin on the server can reset the account (delete its `two_factors` row and set `two_factor_enabled = false`); there is no script for this yet.
- Contributors, trusted contributors and family guardians have no extra features yet; they come with later tasks (P1-05, P3).
- `BETTER_AUTH_SECRET` encrypts the stored authenticator secrets. Changing it signs everyone out and makes every staff member set up the app again.
- When magic links are wanted later, they need an email service (O-6) and a rate limit per address (SPEC 12.2).

## Changes after the security audit (14 Nov 2026)

- **Better Auth's HTTP endpoints are closed.** `app/api/auth/[...all]/route.ts` answers only Google's return address (`/api/auth/callback/google`) and `/api/auth/error`; every other path, and every POST, is 404 (`lib/auth/route.test.ts`). Before this, anyone holding a staff session could call `/two-factor/get-totp-uri` or `/two-factor/disable` (no password exists for a Google-only account, so the library asked for none) and `/two-factor/verify-totp` (no attempt limit for a signed-in session), which made the authenticator check worthless. The app calls the library through server actions only. **Rule: before opening another path, check what it lets a signed-in user do to their own account.**
- **Sessions keep a hash, not the address** (`lib/auth/session-privacy.ts`, a database hook), and Google's tokens are stored encrypted (`account.encryptOAuthTokens`). In production the visitor's address is read from `CF-Connecting-IP`.
- **Correction to "What this weakens" above.** A holder of the website's database password still cannot change `users.role`, but it can insert a session row for an existing admin with `two_factor_verified_at` set (or attach another identity in `accounts`) and so act as that admin. The role guard stops privilege *creation*, not impersonation of an existing staff account. Keep the database off the network and its password out of logs; this is a limit of any design where the website writes its own sessions.
- **Lost phone / account reset** is still a server-side job with no script. If it is needed often, write one (it must run as `migrator`, log to `audit_log`, and end the person's sessions).
