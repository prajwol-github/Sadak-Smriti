"use server";

import { refresh } from "next/cache";
import * as z from "zod";
import { roleOf } from "@/lib/auth/actor";
import { currentActor } from "@/lib/auth/session";
import { run } from "@/lib/db/queries/run";
import { accountById, staffSetBan, staffSetRole } from "@/lib/db/queries/users";
import { canChangeRole, canDeactivate } from "@/lib/policy/can";

/**
 * Account management (ADR 0006). Each action: policy check on the caller (staff, code confirmed
 * this session), then the rules for this particular account, then the database function, which
 * checks every rule again (migration 0007) and writes the audit log. A refused or failed change
 * does nothing; the page shows only the buttons the caller may use.
 */

const ChangeRole = z.object({ id: z.uuid(), role: z.enum(["contributor", "reviewer"]) });
const SetStatus = z.object({ id: z.uuid(), ban: z.enum(["true", "false"]), reason: z.string().trim().max(200).optional() });

export async function changeRole(fd: FormData): Promise<void> {
  const actor = await currentActor();
  const input = ChangeRole.safeParse({ id: fd.get("id"), role: fd.get("role") });
  if (!actor || !input.success) return;
  const [target] = await run(accountById, { id: input.data.id });
  if (!target) return;
  if (canChangeRole(actor, { id: target.id, role: roleOf(target.role) }, input.data.role).kind !== "allow") return;
  try {
    await run(staffSetRole, { actorId: actor.id, targetId: target.id, role: input.data.role });
  } catch (e) {
    console.error("changeRole refused by the database:", e instanceof Error ? e.message : e);
  }
  refresh();
}

export async function setStatus(fd: FormData): Promise<void> {
  const actor = await currentActor();
  const input = SetStatus.safeParse({ id: fd.get("id"), ban: fd.get("ban"), reason: fd.get("reason") ?? undefined });
  if (!actor || !input.success) return;
  const [target] = await run(accountById, { id: input.data.id });
  if (!target) return;
  if (canDeactivate(actor, { id: target.id, role: roleOf(target.role) }).kind !== "allow") return;
  try {
    await run(staffSetBan, { actorId: actor.id, targetId: target.id, ban: input.data.ban === "true", reason: input.data.reason ?? "" });
  } catch (e) {
    console.error("setStatus refused by the database:", e instanceof Error ? e.message : e);
  }
  refresh();
}
