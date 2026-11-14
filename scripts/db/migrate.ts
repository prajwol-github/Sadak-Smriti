/**
 * Applies every migration in db/migrations/ that hasn't run yet (pnpm db:migrate).
 * Runs as role `migrator`, the only role with DDL rights (SPEC 12.3, ADR 0005).
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // CI sets the variables directly.
}

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) {
  console.error("MIGRATOR_DATABASE_URL is not set (copy .env.example to .env.local)");
  process.exit(1);
}

async function main(url: string) {
  // One connection only: migrations must run in order (Drizzle docs).
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "db/migrations" });
    const [{ version }] = await sql`select postgis_version() as version`;
    console.log(`Migrations applied. PostGIS ${version}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main(url);
