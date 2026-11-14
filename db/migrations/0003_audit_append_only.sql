-- 0003 audit log is append-only for the website (custom migration; SPEC 10.5, 12.3; PLAN P0-10)
--
-- The website connects as role `app`. It may add audit rows but never change or remove them,
-- so a compromised or buggy app cannot rewrite history. Only `migrator` (the schema owner) can.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app;
GRANT INSERT, SELECT ON audit_log TO app;

-- Exports and the API never read private or operational tables.
REVOKE SELECT ON submissions, revisions, audit_log, rate_limits, sources FROM readonly;
