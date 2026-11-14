/**
 * Every table, re-exported for drizzle-kit (drizzle.config.ts) and the client.
 * Tables follow SPEC 10; the migrations they produce are in db/migrations/ (ADR 0005).
 */
export * from "./places";
export * from "./crashes";
export * from "./workflow";
export * from "./people";
export * from "./auth";
export * from "./pipeline";
