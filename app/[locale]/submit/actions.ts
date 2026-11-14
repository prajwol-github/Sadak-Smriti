"use server";

import { headers } from "next/headers";
import { transaction } from "@/lib/db/queries/run";
import { formDataToInput, parseReport } from "@/lib/forms/report";
import type { DuplicateView, ReportState, ReportValues } from "@/lib/forms/report-state";
import { clientIp, hashIp } from "@/lib/net/ip-hash";
import { verifyTurnstile } from "@/lib/net/turnstile";
import { bsLong } from "@/lib/format";
import { can } from "@/lib/policy/can";
import { findDuplicates, saveReport, type Choice, type SimilarCrash } from "@/lib/workflow/report";

/**
 * The crash report form's server action (docs/plans/report-a-crash.md step 8; ADR 0004).
 * Order: policy → off switch → honeypot → validation → duplicate question → captcha →
 * one transaction (limits + all writes). The captcha is checked only at the final save,
 * because a token can be used once and the duplicate question is a round trip.
 */

function valuesOf(fd: FormData): ReportValues {
  const out: ReportValues = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$") || k === "cf-turnstile-response" || k === "website" || k === "choice") continue;
    if (k === "vehicles") out.vehicles = [...((out.vehicles as string[]) ?? []), v];
    else out[k] = v;
  }
  return out;
}

function toView(c: SimilarCrash): DuplicateView {
  const published = c.status === "published";
  return {
    id: c.id,
    occurredOn: c.occurredOn,
    dateLabel: { en: bsLong(c.occurredOn, "en"), ne: bsLong(c.occurredOn, "ne") },
    draft: !published,
    // Unreviewed drafts show no text: it hasn't been checked by anyone yet.
    title: published ? { en: c.titleEn, np: c.titleNp } : null,
    place: published ? { en: c.placeNameEn, np: c.placeNameNp } : null,
    deaths: c.deaths,
    injured: c.injured,
    sources: c.sources,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitReport(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const values = valuesOf(fd);

  // Visitors may report; logged-in users will get their own column later (P0-08).
  const decision = can(null, "create_crash");
  if (decision.kind === "deny") return { status: "refused", reason: "closed", values, captchaUsed: false };
  if (process.env.REPORTS_ENABLED === "false") return { status: "refused", reason: "closed", values, captchaUsed: false };

  // Honeypot: people never fill this hidden field. Pretend success and store nothing.
  if (typeof fd.get("website") === "string" && fd.get("website") !== "") {
    return { status: "saved", ref: "--------", kind: "new_crash" };
  }

  const input = formDataToInput(fd);
  // The AD date is used when given (the BS selects are the default).
  input.calendar = typeof input.adDate === "string" && input.adDate ? "ad" : "bs";
  const parsed = parseReport(input);
  if (!parsed.ok) return { status: "errors", errors: parsed.errors as Record<string, string>, values };

  const rawChoice = fd.get("choice");
  const choice: Choice =
    typeof rawChoice === "string" && rawChoice.startsWith("add:") && UUID.test(rawChoice.slice(4))
      ? { kind: "add", crashId: rawChoice.slice(4) }
      : { kind: "new", confirmed: rawChoice === "new" };

  try {
    if (choice.kind === "new" && !choice.confirmed) {
      const dups = await transaction((tx) => findDuplicates(tx, parsed.report));
      if (dups.length > 0) return { status: "duplicates", duplicates: dups.map(toView), values };
    }

    if (decision.kind === "review" && decision.captcha) {
      const ok = await verifyTurnstile(typeof fd.get("cf-turnstile-response") === "string" ? (fd.get("cf-turnstile-response") as string) : null);
      if (!ok) return { status: "refused", reason: "captcha", values, captchaUsed: true };
    }

    const ipHash = hashIp(clientIp(await headers()));
    const result = await transaction((tx) =>
      saveReport(tx, { report: parsed.report, ipHash, choice: choice.kind === "new" ? { kind: "new", confirmed: true } : choice }),
    );

    switch (result.status) {
      case "saved":
        return { status: "saved", ref: result.submissionId.replace(/-/g, "").slice(-8).toUpperCase(), kind: result.kind };
      case "limited":
        return { status: "refused", reason: result.reason, values, captchaUsed: true };
      case "invalid":
        return { status: "errors", errors: result.errors as Record<string, string>, values };
      case "duplicates":
        return { status: "duplicates", duplicates: result.crashes.map(toView), values };
    }
  } catch (err) {
    console.error("submitReport failed", err instanceof Error ? err.message : err);
    return { status: "refused", reason: "failed", values, captchaUsed: true };
  }
}
