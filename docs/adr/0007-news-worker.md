# 0007: The news worker, first version

Date: 14 Nov 2026. Status: accepted (owner's decision).

## Context

SPEC 7.2 describes an 8-step news pipeline, and SPEC 11.2 picks pg-boss for background jobs. The owner asked for a simple worker that runs automatically and on demand, and brings crash news to the approval point, with no AI extraction yet.

## Decision

- **Steps 1 and 2 only:** poll each outlet's RSS feed, keep every entry once (by normalised URL), and mark the ones that look like crash news. Reviewers see those in `/review`, open the article, and report the crash with the existing form. Extraction, grounding and matching (steps 3–6, PLAN P2-03 to P2-06) come later.
- **No pg-boss yet.** A run is a row in `pipeline_runs`. The worker (`worker/index.ts`, `pnpm worker`) queues a scheduled run every 30 minutes, and the "Collect now" button queues a manual one. It takes runs one at a time with `for update skip locked`. A partial unique index allows only one run waiting or running, so pressing the button twice starts one run. This needs no extra schema with DDL rights, and it works with the existing database roles. Switch to pg-boss when there are several kinds of jobs (link checks, exports, digests).
- **Outlets** are listed in `content/outlets.json` (public information) and copied into the database with `pnpm pipeline:outlets`. The 8 feeds from SPEC 7.2 were checked on 14 Nov 2026.
- **Polite collection:** the worker reads each outlet's robots.txt first and stops if it is asked to, sends a user agent naming the bot, makes one feed request per outlet per run, and limits time (10 s), size (5 MB) and redirects (3). A page explaining the bot does not exist yet; the user agent links to the site.
- **Filter rules** (`lib/pipeline/filter.ts`) are generous on purpose: a wrong candidate costs a reviewer one click, a missed crash is a death never recorded. The spike's rules were not in this checkout, so these are new. On the first real run (184 articles) they gave 14 candidates, 11 of them road crashes, and missed none of the death or injury stories checked by hand.

## Consequences

- The worker must run as its own process (a container in production, SPEC 11.1); without it, "Collect now" only queues.
- After 3 failures in a row for an outlet, the worker logs an `ALERT` line. Emailing admins needs the email service (O-6).
- Each new filter rule needs a test in `lib/pipeline/pipeline.test.ts` with an invented headline.
