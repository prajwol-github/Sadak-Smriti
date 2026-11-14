"use server";

import { refresh } from "next/cache";
import * as z from "zod";
import { currentActor } from "@/lib/auth/session";
import { decideFeedItem, requestRun } from "@/lib/db/queries/pipeline";
import { run } from "@/lib/db/queries/run";
import { can } from "@/lib/policy/can";

/** The news queue's two actions (SPEC 7.2; ADR 0007). Reviewers and admins, after the code check. */

const Decision = z.object({ id: z.uuid(), status: z.enum(["done", "dismissed"]) });

export async function decideNews(fd: FormData): Promise<void> {
  const actor = await currentActor();
  if (!actor || can(actor, "review_news").kind !== "allow") return;
  const parsed = Decision.safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return;
  await run(decideFeedItem, { ...parsed.data, userId: actor.id });
  refresh();
}

export async function collectNow(): Promise<void> {
  const actor = await currentActor();
  if (!actor || can(actor, "run_pipeline").kind !== "allow") return;
  // Does nothing if a run is already waiting or running (pipeline_runs_one_active).
  await run(requestRun, { trigger: "manual", requestedBy: actor.id });
  refresh();
}
