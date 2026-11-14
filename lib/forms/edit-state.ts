/** What a staff edit form shows after it is submitted (app/[locale]/review/crashes/actions.ts). */
export interface EditState {
  status: "idle" | "saved" | "invalid" | "conflict" | "refused";
  /** Field name → key of the "Edit.error" messages. */
  errors?: Record<string, string>;
  /** Key of "Edit.refused" when status is "refused". */
  refusal?: string;
  /**
   * What was submitted, sent back when a save is refused. React 19 resets a form after its action,
   * so the fields use these as their defaults and nothing typed is lost.
   */
  values?: Record<string, string | string[]>;
}

export const IDLE: EditState = { status: "idle" };
