import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env files itself; Node can (ADR 0005).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI sets the variables directly).
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  // All SQL lives under db/ (ADR 0005).
  out: "./db/migrations",
  dbCredentials: { url: process.env.MIGRATOR_DATABASE_URL ?? "" },
  // PostGIS owns these tables; never let drizzle-kit try to manage them.
  extensionsFilters: ["postgis"],
  strict: true,
  verbose: true,
});
