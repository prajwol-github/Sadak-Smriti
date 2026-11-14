"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { currentActor } from "@/lib/auth/session";
import { transaction } from "@/lib/db/queries/run";
import { routing } from "@/lib/i18n/routing";
import { can } from "@/lib/policy/can";
import { REJECTION_REASONS, decideSubmission, type DecisionInput, type RejectionReason } from "@/lib/workflow/decide";

/**
 * Approve, reject or ask for changes (SPEC 7.4; PLAN P1-07). Policy check on the caller, then
 * decideSubmission applies every rule inside one transaction (not your own, not twice, two
 * approvals where required). The result goes back to the list as a short message.
 */

const Form = z.object({
  id: z.uuid(),
  locale: z.enum(routing.locales),
  decision: z.enum(["approve", "reject", "request_changes"]),
  reason: z.enum(REJECTION_REASONS as [string, ...string[]]).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function decide(fd: FormData): Promise<void> {
  const parsed = Form.safeParse({
    id: fd.get("id"), locale: fd.get("locale"), decision: fd.get("decision"),
    reason: fd.get("reason") || undefined, note: fd.get("note") || undefined,
  });
  if (!parsed.success) redirect(`/${routing.defaultLocale}/review/submissions`);
  const { id, locale, decision, reason, note } = parsed.data;
  const base = `/${locale}/review/submissions`;

  const actor = await currentActor();
  if (!actor || can(actor, "review_submissions").kind !== "allow") redirect(base);

  let input: DecisionInput;
  if (decision === "approve") input = { kind: "approve" };
  else if (decision === "reject") {
    if (!reason) redirect(`${base}/${id}`);
    input = { kind: "reject", reason: reason as RejectionReason, note };
  } else {
    if (!note) redirect(`${base}/${id}`);
    input = { kind: "request_changes", note };
  }

  const result = await transaction((tx) => decideSubmission(tx, actor, id, input));
  const key = result.status === "refused" ? result.reason : result.status;
  // Anything that moved on goes back to the list; a refusal stays on the report with the reason.
  redirect(result.status === "refused" && result.reason !== "closed" && result.reason !== "not_found"
    ? `${base}/${id}?result=${key}`
    : `${base}?result=${key}`);
}
