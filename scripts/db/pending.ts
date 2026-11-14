/**
 * pnpm db:pending — lists reports waiting for review, oldest first, until the review queue
 * exists (PLAN P1-07). Read-only. Shows whether a contact was given, never the contact itself.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../lib/db/schema";
import type { Executor } from "../../lib/db/queries/define";
import { pendingReports } from "../../lib/db/queries/reports";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // CI sets the variables directly.
}

async function main(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await pendingReports.build(drizzle(client, { schema }) as unknown as Executor, { limit: 50 });
    if (rows.length === 0) {
      console.log("No reports are waiting for review.");
      return;
    }
    console.log(`${rows.length} report(s) waiting for review, oldest first:\n`);
    for (const r of rows) {
      const ref = r.id.replace(/-/g, "").slice(-8).toUpperCase();
      const when = new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16);
      console.log(`● ${ref}  ${r.kind === "new_crash" ? "New crash" : "Addition to an existing crash"}  (sent ${when} UTC)`);
      console.log(`  ${r.occurred_on} · ${r.district}${r.place ? ` · ${r.place}` : ""}`);
      console.log(`  ${r.deaths} killed · ${r.injured ?? "?"} injured${r.vehicles ? ` · ${r.vehicles}` : ""}`);
      if (r.source_kind === "news") console.log(`  Source: ${r.source_url}`);
      else if (r.witness) console.log(`  Witness (private): ${r.witness}`);
      console.log(`  Needs ${r.required_approvals} approval(s) · flags: ${r.flags.join(", ") || "none"} · contact given: ${r.has_contact ? "yes" : "no"}`);
      console.log(`  Crash ${r.crash_id} (${r.crash_status})\n`);
    }
  } finally {
    await client.end();
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (copy .env.example to .env.local)");
  process.exit(1);
}
void main(url);
