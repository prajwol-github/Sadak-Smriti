"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { currentActor } from "@/lib/auth/session";
import { transaction } from "@/lib/db/queries/run";
import {
  parseCrashCreate, parseCrashFacts, parseNewsLink, parsePerson, parsePublish, parseReasonOnly, type Raw,
} from "@/lib/forms/crash-edit";
import type { EditState } from "@/lib/forms/edit-state";
import { routing } from "@/lib/i18n/routing";
import { can, type Actor } from "@/lib/policy/can";
import {
  addNewsLink, createCrash, removePerson, restoreVersion, saveCrashFacts, savePerson, setCrashPublished, type EditResult,
} from "@/lib/workflow/edit-crash";

/**
 * The staff crash editor's actions (ADR 0008). Each one: policy check on the caller, parse and
 * validate the form, then the workflow applies it in one transaction (version check, business
 * rules, history with the reason, audit). The result comes back as a state the form shows; a
 * successful save also refreshes the page so every section shows the new version.
 */

const Id = z.uuid();

function raw(fd: FormData): Raw {
  const out: Raw = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    if (k === "vehicles") out.vehicles = [...((out.vehicles as string[] | undefined) ?? []), v];
    else out[k] = v;
  }
  return out;
}

async function staff(action: Parameters<typeof can>[1]): Promise<Actor | null> {
  const actor = await currentActor();
  return actor && can(actor, action).kind === "allow" ? actor : null;
}

const refused: EditState = { status: "refused", refusal: "not_permitted" };

function toState(r: EditResult, fd: FormData): EditState {
  if (r.status === "saved") {
    refresh();
    return { status: "saved" };
  }
  const values = raw(fd) as Record<string, string | string[]>;
  if (r.status === "conflict") return { status: "conflict", values };
  if (r.status === "invalid") return { status: "invalid", errors: r.errors, values };
  return { status: "refused", refusal: r.reason, values };
}

function crashIdOf(fd: FormData): string | null {
  const id = Id.safeParse(fd.get("crashId"));
  return id.success ? id.data : null;
}

export async function saveFacts(_prev: EditState, fd: FormData): Promise<EditState> {
  const actor = await staff("edit_crash");
  const crashId = crashIdOf(fd);
  if (!actor || !crashId) return refused;
  const parsed = parseCrashFacts(raw(fd));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  return toState(await transaction((tx) => saveCrashFacts(tx, actor, crashId, parsed.value)), fd);
}

export async function publish(_prev: EditState, fd: FormData): Promise<EditState> {
  const actor = await staff("edit_crash");
  const crashId = crashIdOf(fd);
  if (!actor || !crashId) return refused;
  const parsed = parsePublish(raw(fd));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  return toState(await transaction((tx) => setCrashPublished(tx, actor, crashId, parsed.value)), fd);
}

export async function addLink(_prev: EditState, fd: FormData): Promise<EditState> {
  const actor = await staff("add_news_link");
  const crashId = crashIdOf(fd);
  if (!actor || !crashId) return refused;
  const parsed = parseNewsLink(raw(fd));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  return toState(await transaction((tx) => addNewsLink(tx, actor, crashId, parsed.value)), fd);
}

export async function savePersonForm(_prev: EditState, fd: FormData): Promise<EditState> {
  const crashId = crashIdOf(fd);
  const personField = fd.get("personId");
  const personId = typeof personField === "string" && personField !== "" ? Id.safeParse(personField) : null;
  if (personId && !personId.success) return refused;
  const actor = await staff(personId ? "edit_person" : "add_person");
  if (!actor || !crashId) return refused;
  const parsed = parsePerson(raw(fd), personId ? "edit" : "add");
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  return toState(await transaction((tx) => savePerson(tx, actor, crashId, personId ? personId.data : null, parsed.value)), fd);
}

export async function removePersonForm(_prev: EditState, fd: FormData): Promise<EditState> {
  const actor = await staff("delete");
  const crashId = crashIdOf(fd);
  const personId = Id.safeParse(fd.get("personId"));
  if (!actor || !crashId || !personId.success) return refused;
  const parsed = parseReasonOnly(raw(fd));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  return toState(await transaction((tx) => removePerson(tx, actor, crashId, personId.data, parsed.value.reason)), fd);
}

/** Plain form on the history page: puts an earlier version back, then returns to the history with a message. */
export async function restoreForm(fd: FormData): Promise<void> {
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(fd.get("locale"));
  const crashId = crashIdOf(fd);
  const revisionId = Id.safeParse(fd.get("revisionId"));
  const actor = await staff("edit_crash");
  if (!crashId) redirect(`/${locale}/review/crashes`);
  const back = `/${locale}/review/crashes/${crashId}/history`;
  const parsed = parseReasonOnly(raw(fd));
  if (!actor || !revisionId.success || !parsed.ok) redirect(`${back}?result=refused`);
  const r = await transaction((tx) => restoreVersion(tx, actor, crashId, revisionId.data, parsed.value.reason));
  redirect(`${back}?result=${r.status === "saved" ? "restored" : r.status === "invalid" ? Object.values(r.errors)[0] : r.status === "refused" ? "refused" : "conflict"}`);
}

/** Staff crash creation. Parses the form, creates the crash, then redirects to its edit page. */
export async function createCrashAction(_prev: EditState, fd: FormData): Promise<EditState> {
  const actor = await staff("create_crash");
  if (!actor) return refused;
  const parsed = parseCrashCreate(raw(fd));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: raw(fd) as Record<string, string | string[]> };
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(fd.get("locale"));
  const r = await transaction((tx) => createCrash(tx, actor, parsed.value));
  if (r.status !== "saved" || !r.crashId) return toState(r, fd);
  redirect(`/${locale}/review/crashes/${r.crashId}`);
}
