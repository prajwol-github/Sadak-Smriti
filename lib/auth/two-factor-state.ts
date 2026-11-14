/** What the authenticator-app form shows next (app/[locale]/account/two-factor/actions.ts). */
export interface TwoFactorState {
  step: "start" | "scan" | "code";
  error?: "wrong" | "locked" | "error";
  /** QR code rows, "1" for a dark module. Drawn as SVG rects: no data URI, no innerHTML. */
  qr?: string[];
  /** The secret, for typing into the app by hand. */
  secret?: string;
  /** Shown once, right after setup starts. */
  backupCodes?: string[];
}
