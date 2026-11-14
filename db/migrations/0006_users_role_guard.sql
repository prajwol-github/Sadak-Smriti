-- 0006 new accounts can be created again; roles stay server-only (custom migration; ADR 0006)
--
-- Migration 0005 gave the website (role `app`) INSERT on every users column except `role`.
-- Drizzle names every column in an insert, writing DEFAULT for the ones it doesn't set, and
-- Postgres requires the privilege on every column named, so Google sign-up failed with
-- "permission denied for table users".
--
-- Now `app` may name every column on insert, and a trigger refuses any new row whose role is not
-- 'contributor' (or that arrives already banned). UPDATE stays as in 0005: `app` still cannot
-- write `role` at all. The trigger function belongs to `migrator`; `app` cannot change or switch
-- it off (no DDL rights).
GRANT INSERT ON users TO app;--> statement-breakpoint

CREATE FUNCTION users_new_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'app' AND (NEW.role <> 'contributor' OR NEW.banned_at IS NOT NULL OR NEW.ban_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'a new account is always a contributor; roles are set with pnpm users:role'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION users_new_account_guard() FROM PUBLIC;--> statement-breakpoint

CREATE TRIGGER users_new_account_guard BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION users_new_account_guard();
