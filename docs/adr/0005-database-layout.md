# 0005: Database code and where SQL lives

Date: 13 Nov 2026. Status: accepted (owner's decision).

## Context

The owner wants every SQL statement the project runs to be readable in one folder, because the project is open source and contributors should be able to see and review the SQL without learning an ORM. SPEC 11.2 picks Drizzle ORM. The owner chose to keep Drizzle.

## Decision

- **Drizzle stays** for schema definitions (`lib/db/schema/*.ts`), typed queries and migrations, with **postgres.js** as the driver.
- **All SQL lives under `db/`:**
  - `db/migrations/`: drizzle-kit's generated SQL, committed, plus hand-written custom migrations (`drizzle-kit generate --custom`) for what Drizzle cannot express: extensions, grants, check constraints, triggers, spatial indexes.
  - `db/queries/`: one `.sql` file per query the app runs, **generated** from the query functions by `pnpm db:queries`. A test regenerates them in memory and fails if a committed file is out of date, so every pull request shows the exact SQL change.
  - `db/seeds/`: invented development data only.
- **Only `lib/db/queries/` talks to the database.** Each query is a named function registered with `defineQuery("<area>/<name>", …)`. A test fails if any other file imports the database client.
- **Roles (SPEC 12.3):** migrations run as `migrator`; the app runs as `app` (no DDL, INSERT only on `audit_log`); exports and the API will use `readonly`.
- Migrations are forward-only and never edited after they have run anywhere.

## Consequences

- Readers get SQL in one place; writers get types from Drizzle. The price is a generation step (`pnpm db:queries`) that the test enforces.
- Spatial and other SQL that the query builder can't produce is written with Drizzle's `sql` template inside the same registry, so it is tracked the same way.
- If `toSQL()` cannot run without a live connection in the installed Drizzle version, the snapshot step uses a throwaway client that never connects. This is checked when the registry is built (plan step 2) and the outcome is recorded in `db/README.md`.
