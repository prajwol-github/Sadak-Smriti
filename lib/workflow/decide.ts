import { randomBytes } from "node:crypto";
import type { Executor } from "@/lib/db/queries/define";
import { insertAudit, insertRevision } from "@/lib/db/queries/reports";
import {
  attachFollowUpSource, bumpCrashVersion, closeSubmission, crashSourceCount, districtSlug, insertReview, lockSubmission,
  publishCrash, rejectCrash, reviewsForSubmission, scheduleContactPurge,
} from "@/lib/db/queries/submissions";
import { canDecide, type Actor } from "@/lib/policy/can";

/**
 * A reviewer's decision on a submission (SPEC 7.3, 7.4; PLAN P1-07). Runs inside the caller's
 * transaction, so the review, the change to the crash, the revision and the audit row are written
 * together or not at all.
 *
 * Rules, all checked here: only a reviewer or admin whose code check is current (canDecide); never
 * their own submission; never the same submission twice; a submission with two required approvals
 * waits for a second, different reviewer; a rejection needs a reason.
 */

export type RejectionReason = "duplicate" | "no_source" | "wrong_info" | "abuse" | "graphic" | "off_topic";
export const REJECTION_REASONS: readonly RejectionReason[] = ["duplicate", "no_source", "wrong_info", "abuse", "graphic", "off_topic"];

export type DecisionInput =
  | { kind: "approve" }
  | { kind: "reject"; reason: RejectionReason; note?: string }
  | { kind: "request_changes"; note: string };

export type DecideResult =
  | { status: "published" }
  | { status: "waiting"; approvals: number; required: number }
  | { status: "rejected" }
  | { status: "changes_requested" }
  | { status: "refused"; reason: "not_found" | "closed" | "not_permitted" | "already_decided" | "unsupported" };

const isoDate = (d: string) => d.slice(0, 10);

export async function decideSubmission(tx: Executor, actor: Actor, submissionId: string, input: DecisionInput): Promise<DecideResult> {
  const [sub] = await lockSubmission.build(tx, { id: submissionId });
  if (!sub) return { status: "refused", reason: "not_found" };
  if (sub.status !== "pending") return { status: "refused", reason: "closed" };
  if (sub.kind !== "new_crash" && sub.kind !== "add_source") return { status: "refused", reason: "unsupported" };
  if (!sub.targetId) return { status: "refused", reason: "not_found" };

  const earlier = await reviewsForSubmission.build(tx, { submissionId });
  if (earlier.some((r) => r.reviewerId === actor.id)) return { status: "refused", reason: "already_decided" };
  const approvedBy = earlier.filter((r) => r.decision === "approve").map((r) => r.reviewerId);
  if (canDecide(actor, { submittedBy: sub.submittedBy, approvedBy }).kind !== "allow") return { status: "refused", reason: "not_permitted" };

  const note = input.kind === "approve" ? null : (input.note?.trim().slice(0, 1000) || null);
  await insertReview.build(tx, {
    submissionId, reviewerId: actor.id, decision: input.kind,
    reasonCode: input.kind === "reject" ? input.reason : null, note,
  });
  const audit = (action: string, after: Record<string, unknown>) =>
    insertAudit.build(tx, { actorId: actor.id, action, targetType: "submission", targetId: submissionId, after: { kind: sub.kind, crashId: sub.targetId, ...after }, ipHash: null });

  if (input.kind === "request_changes") {
    await closeSubmission.build(tx, { id: submissionId, status: "changes_requested" });
    await audit("submission.request_changes", { note });
    return { status: "changes_requested" };
  }

  if (input.kind === "reject") {
    await closeSubmission.build(tx, { id: submissionId, status: "rejected" });
    if (sub.kind === "new_crash") {
      const [crash] = await rejectCrash.build(tx, { crashId: sub.targetId });
      if (crash) await insertRevision.build(tx, { entityType: "crash", entityId: crash.id, version: crash.version, data: crash, submissionId, actorId: actor.id });
    }
    await scheduleContactPurge.build(tx, { id: submissionId });
    await audit("submission.reject", { reason: input.reason, note });
    return { status: "rejected" };
  }

  // Approve. Final only when enough different reviewers have approved.
  const approvals = approvedBy.length + 1;
  if (approvals < sub.requiredApprovals) {
    await audit("submission.approve", { approvals, required: sub.requiredApprovals, final: false });
    return { status: "waiting", approvals, required: sub.requiredApprovals };
  }

  const payload = (sub.payload ?? {}) as { occurredOn?: string; districtId?: string; sourceId?: string };
  const [{ n: sources }] = await crashSourceCount.build(tx, { crashId: sub.targetId });

  if (sub.kind === "new_crash") {
    if (!payload.districtId || !payload.occurredOn) return { status: "refused", reason: "unsupported" };
    const [district] = await districtSlug.build(tx, { districtId: payload.districtId });
    const slug = `${isoDate(payload.occurredOn)}-${district?.slug ?? "nepal"}-${randomBytes(3).toString("hex")}`;
    const [crash] = await publishCrash.build(tx, { crashId: sub.targetId, slug, verification: sources >= 2 ? "multi_source" : "single_source" });
    if (!crash) return { status: "refused", reason: "closed" }; // the draft was already decided some other way
    await insertRevision.build(tx, { entityType: "crash", entityId: crash.id, version: crash.version, data: crash, submissionId, actorId: actor.id });
  } else {
    if (!payload.sourceId) return { status: "refused", reason: "unsupported" };
    await attachFollowUpSource.build(tx, { crashId: sub.targetId, sourceId: payload.sourceId });
    const [{ n: after }] = await crashSourceCount.build(tx, { crashId: sub.targetId });
    const [crash] = await bumpCrashVersion.build(tx, { crashId: sub.targetId, verification: after >= 2 ? "multi_source" : "single_source" });
    if (crash) await insertRevision.build(tx, { entityType: "crash", entityId: crash.id, version: crash.version, data: crash, submissionId, actorId: actor.id });
  }

  await closeSubmission.build(tx, { id: submissionId, status: "approved" });
  await scheduleContactPurge.build(tx, { id: submissionId });
  await audit("submission.approve", { approvals, required: sub.requiredApprovals, final: true });
  return { status: "published" };
}
