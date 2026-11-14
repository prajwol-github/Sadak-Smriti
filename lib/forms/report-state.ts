/**
 * What the report action returns to the form (shared by the server action and the client form,
 * so it has no server-only imports). `values` refills the form after a round trip.
 */
export type ReportValues = Record<string, string | string[]>;

/** A possible duplicate as shown to a visitor. Drafts show only date and counts (unreviewed text stays private). */
export interface DuplicateView {
  id: string;
  occurredOn: string;
  /** The date in BS, in both languages ("26 Kartik 2083" / "कात्तिक २६, २०८३"). */
  dateLabel: { en: string; ne: string };
  draft: boolean;
  title: { en: string | null; np: string | null } | null;
  place: { en: string | null; np: string | null } | null;
  deaths: number;
  injured: number | null;
  sources: number;
}

export type RefusalKey = "captcha" | "hour" | "day" | "site" | "closed" | "failed";

export type ReportState =
  | { status: "idle" }
  | { status: "errors"; errors: Record<string, string>; values: ReportValues }
  | { status: "duplicates"; duplicates: DuplicateView[]; values: ReportValues }
  | { status: "refused"; reason: RefusalKey; values: ReportValues; captchaUsed: boolean }
  | { status: "saved"; ref: string; kind: "new_crash" | "add_source" };

export const INITIAL_REPORT_STATE: ReportState = { status: "idle" };
