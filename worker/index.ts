/**
 * The background worker (SPEC 11.1, 13.3; ADR 0007): collects crash news every 30 minutes, and
 * whenever a reviewer presses "Run now" in /review.
 *
 *   pnpm worker          keep running (production runs this as its own container)
 *   pnpm worker --once   queue one run, do it, print the result and exit
 *
 * Runs are rows in pipeline_runs. Every POLL_MS the worker queues a scheduled run if the last one
 * is 30 minutes old, then takes the oldest queued run (`for update skip locked`) and does it.
 * One run at a time; the database refuses a second queued or running run.
 */
import { claimRun, failStaleRuns, finishRun, lastRunAt, requestRun } from "@/lib/db/queries/pipeline";
import { openDatabase } from "@/lib/db/standalone";
import { runRetention } from "@/lib/maintenance/retention";
import { BOT_TOKEN, collectNews } from "@/lib/pipeline/collect";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // The server sets the variables directly.
}

const SCHEDULE_MS = 30 * 60 * 1000;
const POLL_MS = 15 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const once = process.argv.includes("--once");

const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
  console.error("SITE_URL is not set (see .env.example). The bot's user agent links to the site.");
  process.exit(1);
}
// TODO: link a page that explains the bot (SPEC 7.2) once one exists; the site root for now.
const USER_AGENT = `${BOT_TOKEN}/0.1 (+${siteUrl.replace(/\/$/, "")})`;

const db = openDatabase(process.env.DATABASE_URL, { max: 2 });
const log = (msg: string) => console.log(`${new Date().toISOString()} ${msg}`);

let lastRetention = 0;
/** Once a day: delete what SPEC 12.3 says we do not keep (contacts, IP hashes, flood counters). */
async function retentionIfDue() {
  if (Date.now() - lastRetention < RETENTION_MS) return;
  // A failed clean-up must not stop news collection; try again in an hour.
  let r;
  try {
    r = await runRetention(db.exec);
  } catch (e) {
    lastRetention = Date.now() - RETENTION_MS + 60 * 60 * 1000;
    log(`retention failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  lastRetention = Date.now();
  log(`retention: ${r.contacts} contact(s), ${r.submissionIpHashes + r.auditIpHashes} ip hash(es), ${r.rateLimitRows} counter row(s) removed`);
}

async function scheduleIfDue() {
  const [{ at }] = await db.run(lastRunAt, {});
  if (!at || Date.now() - new Date(at).getTime() >= SCHEDULE_MS) {
    const queued = await db.run(requestRun, { trigger: "schedule", requestedBy: null });
    if (queued.length) log("queued a scheduled run");
  }
}

/** Does one queued run, if there is one. Returns false when the queue was empty. */
async function runNext(): Promise<boolean> {
  const [run] = await db.run(claimRun, {});
  if (!run) return false;
  log(`run ${run.id} (${run.trigger}) started`);
  try {
    const r = await collectNews(db.exec, {
      userAgent: USER_AGENT,
      onRepeatedFailure: (slug, n, error) => log(`ALERT outlet ${slug} failed ${n} times in a row: ${error}`),
    });
    await db.run(finishRun, {
      id: run.id, status: "succeeded", itemsSeen: r.itemsSeen, itemsNew: r.itemsNew, candidatesNew: r.candidatesNew,
      outletResults: r.outlets, error: null,
    });
    log(`run ${run.id} done: ${r.itemsSeen} seen, ${r.itemsNew} new, ${r.candidatesNew} likely crash news`);
    for (const o of r.outlets) log(`  ${o.ok ? "ok  " : "FAIL"} ${o.slug}: ${o.items} items, ${o.new} new, ${o.candidates} candidates${o.error ? ` (${o.error})` : ""}`);
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await db.run(finishRun, { id: run.id, status: "failed", itemsSeen: 0, itemsNew: 0, candidatesNew: 0, outletResults: [], error });
    log(`run ${run.id} failed: ${error}`);
  }
  return true;
}

async function main() {
  const stale = await db.run(failStaleRuns, {});
  if (stale.length) log(`closed ${stale.length} run(s) left running by a stopped worker`);

  if (once) {
    await db.run(requestRun, { trigger: "manual", requestedBy: null });
    if (!(await runNext())) log("nothing to run");
    await db.close();
    return;
  }

  let stopping = false;
  const stop = () => {
    stopping = true;
    log("stopping after the current step");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  log(`worker started; collecting every ${SCHEDULE_MS / 60000} min and on "Run now"`);
  while (!stopping) {
    try {
      await retentionIfDue();
      await scheduleIfDue();
      while (!stopping && (await runNext()));
    } catch (e) {
      log(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await db.close();
}

void main();
