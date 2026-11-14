import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";

/**
 * Sign-in (SPEC 4, 10.5; ADR 0006). Better Auth reads and writes these tables through its Drizzle
 * adapter (lib/db/auth-adapter.ts); the TypeScript property names are the field names it expects
 * (`emailVerified`, `userId`, …), the columns are snake_case like every other table.
 *
 * Roles live only here, in the database. No email address or name of a reviewer or admin is in
 * the repository; a role is changed with `pnpm users:role` on the server, and every change is
 * written to audit_log.
 */

export const userRole = pgEnum("user_role", ["contributor", "trusted", "reviewer", "admin"]);

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Set only by `pnpm users:role` (never by sign-in or a form: Better Auth `input: false`). */
  role: userRole("role").notNull().default("contributor"),
  /** Better Auth two-factor plugin: true once the authenticator app is set up and confirmed. */
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  banReason: text("ban_reason"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: id(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  /**
   * When this session passed the authenticator-app check. Staff powers need it (lib/auth/actor.ts):
   * Google sign-in alone never grants them, because the two-factor plugin only challenges
   * password sign-ins (ADR 0006).
   */
  twoFactorVerifiedAt: timestamp("two_factor_verified_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** One row per sign-in provider linked to a user (only Google for now). */
export const accounts = pgTable("accounts", {
  id: id(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
}, (t) => [index("accounts_user_idx").on(t.userId)]);

/** Short-lived values: OAuth state, two-factor challenges, trusted devices. */
export const verifications = pgTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => [index("verifications_identifier_idx").on(t.identifier)]);

/** Authenticator-app secret and backup codes, both stored encrypted by Better Auth. */
export const twoFactors = pgTable("two_factors", {
  id: id(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  verified: boolean("verified").notNull().default(true),
  failedVerificationCount: integer("failed_verification_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
}, (t) => [index("two_factors_user_idx").on(t.userId), index("two_factors_secret_idx").on(t.secret)]);
