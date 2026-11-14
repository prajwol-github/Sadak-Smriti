-- 0005 who may change a user's role (custom migration; SPEC 4.1, 12.3; ADR 0006)
--
-- The website connects as role `app`. It creates users when they first sign in with Google and
-- keeps their name, picture and two-factor flag up to date, but it can never write `role`:
-- not on insert (new users get the column default, 'contributor') and not on update. So even a
-- bug or a compromised website cannot make anyone a reviewer or an admin.
--
-- Roles are changed only by `pnpm users:role`, which connects as `migrator`. That needs the
-- server's credentials, so only someone with access to the server can make an admin.
REVOKE INSERT, UPDATE ON users FROM app;--> statement-breakpoint
GRANT INSERT (id, name, email, email_verified, image, two_factor_enabled, created_at, updated_at) ON users TO app;--> statement-breakpoint
GRANT UPDATE (name, email, email_verified, image, two_factor_enabled, banned_at, ban_reason, updated_at) ON users TO app;--> statement-breakpoint

-- Exports and the public API (role `readonly`) never read accounts, sessions or the news queue.
REVOKE SELECT ON users, sessions, accounts, verifications, two_factors, outlets, feed_items, pipeline_runs FROM readonly;
