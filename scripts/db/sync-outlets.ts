/**
 * pnpm pipeline:outlets — copies content/outlets.json into the outlets table (add or update by
 * slug; an outlet removed from the file is left as it is, so disable it with "enabled": false).
 */
import { readFileSync } from "node:fs";
import * as z from "zod";
import { upsertOutlet } from "../../lib/db/queries/pipeline";
import { openDatabase } from "../../lib/db/standalone";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // The server sets the variables directly.
}

const Outlets = z.object({
  outlets: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(100),
    language: z.enum(["ne", "en"]),
    feedUrl: z.url({ protocol: /^https$/ }),
    enabled: z.boolean(),
  })),
});

async function main() {
  const { outlets } = Outlets.parse(JSON.parse(readFileSync("content/outlets.json", "utf8")));
  const db = openDatabase(process.env.DATABASE_URL, { max: 1 });
  try {
    for (const o of outlets) await db.run(upsertOutlet, o);
    console.log(`${outlets.length} outlet(s) saved (${outlets.filter((o) => o.enabled).length} enabled).`);
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
