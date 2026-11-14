-- 0010 IP hashes are kept 30 days (custom migration; SPEC 12.3; audit finding 5)
--
-- `audit_log` is append-only for the website (0003), so the website cannot blank an old IP hash
-- itself. This function can, and can do nothing else: it touches only the `ip_hash` column of rows
-- older than 30 days. It is SECURITY DEFINER (runs as `migrator`, who owns the table) with a fixed
-- search_path, and only `app` may call it. The worker calls it once a day (worker/index.ts).
CREATE FUNCTION purge_old_audit_ip_hashes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n integer;
BEGIN
  UPDATE audit_log SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION purge_old_audit_ip_hashes() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_old_audit_ip_hashes() TO app;
