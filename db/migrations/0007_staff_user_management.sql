-- 0007 staff manage accounts from the website, within hard limits (custom migration; ADR 0006)
--
-- Roles stay out of the website's reach (0005, 0006). Two functions are the only way in, and the
-- rules are enforced here, in the database, whatever the website's code does:
--
--   staff_set_role(actor, target, role)
--     the actor must be an admin; only contributor <-> reviewer; never on yourself; never to or
--     from admin or trusted. Making an admin stays `pnpm users:role` on the server.
--   staff_set_ban(actor, target, ban, reason)
--     the actor must be a reviewer or admin; never on yourself; never on an admin; a reviewer
--     can only act on contributors, an admin also on reviewers.
--
-- Both end the target's sessions and write the audit log. They are SECURITY DEFINER (they run as
-- `migrator`, who owns the tables), with a fixed search_path, and only `app` may run them.
--
-- What this does NOT stop: someone holding the website's database password and an admin's
-- account id could still call staff_set_role, but only to create reviewers, never admins.
-- Whether the person at the keyboard passed the authenticator-app check is the website's job
-- (lib/auth/actor.ts); the database only knows the account has an authenticator app switched on.

CREATE FUNCTION staff_set_role(p_actor uuid, p_target uuid, p_role user_role) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  a users%ROWTYPE;
  t users%ROWTYPE;
BEGIN
  SELECT * INTO a FROM users WHERE id = p_actor;
  IF NOT FOUND OR a.role <> 'admin' OR a.banned_at IS NOT NULL OR NOT a.two_factor_enabled THEN
    RAISE EXCEPTION 'only an admin with an authenticator app can change roles' USING ERRCODE = '42501';
  END IF;
  IF p_target = p_actor THEN
    RAISE EXCEPTION 'you cannot change your own role' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM users WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such account' USING ERRCODE = 'P0002';
  END IF;
  IF t.role NOT IN ('contributor', 'reviewer') OR p_role NOT IN ('contributor', 'reviewer') THEN
    RAISE EXCEPTION 'the website only moves accounts between contributor and reviewer' USING ERRCODE = '42501';
  END IF;
  IF t.role = p_role THEN
    RETURN;
  END IF;

  UPDATE users SET role = p_role, updated_at = now() WHERE id = p_target;
  DELETE FROM sessions WHERE user_id = p_target;
  INSERT INTO audit_log (actor_id, action, target_type, target_id, after)
    VALUES (p_actor, 'user.role_change', 'user', p_target, jsonb_build_object('from', t.role, 'to', p_role, 'via', 'website'));
END;
$$;--> statement-breakpoint

CREATE FUNCTION staff_set_ban(p_actor uuid, p_target uuid, p_ban boolean, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  a users%ROWTYPE;
  t users%ROWTYPE;
BEGIN
  SELECT * INTO a FROM users WHERE id = p_actor;
  IF NOT FOUND OR a.role NOT IN ('reviewer', 'admin') OR a.banned_at IS NOT NULL OR NOT a.two_factor_enabled THEN
    RAISE EXCEPTION 'only a reviewer or admin with an authenticator app can deactivate accounts' USING ERRCODE = '42501';
  END IF;
  IF p_target = p_actor THEN
    RAISE EXCEPTION 'you cannot deactivate yourself' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM users WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such account' USING ERRCODE = 'P0002';
  END IF;
  IF t.role = 'admin' OR (a.role = 'reviewer' AND t.role NOT IN ('contributor', 'trusted')) THEN
    RAISE EXCEPTION 'you may not change this account' USING ERRCODE = '42501';
  END IF;
  IF (t.banned_at IS NOT NULL) = p_ban THEN
    RETURN;
  END IF;

  IF p_ban THEN
    UPDATE users SET banned_at = now(), ban_reason = left(p_reason, 200), updated_at = now() WHERE id = p_target;
    DELETE FROM sessions WHERE user_id = p_target;
  ELSE
    UPDATE users SET banned_at = NULL, ban_reason = NULL, updated_at = now() WHERE id = p_target;
  END IF;
  INSERT INTO audit_log (actor_id, action, target_type, target_id, after)
    VALUES (p_actor, CASE WHEN p_ban THEN 'user.deactivate' ELSE 'user.reactivate' END, 'user', p_target,
            jsonb_build_object('reason', CASE WHEN p_ban THEN left(p_reason, 200) END, 'role', t.role, 'via', 'website'));
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION staff_set_role(uuid, uuid, user_role) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_set_ban(uuid, uuid, boolean, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION staff_set_role(uuid, uuid, user_role) TO app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION staff_set_ban(uuid, uuid, boolean, text) TO app;--> statement-breakpoint

-- Deactivation goes through staff_set_ban only; the website can no longer write these directly.
REVOKE UPDATE (banned_at, ban_reason) ON users FROM app;
