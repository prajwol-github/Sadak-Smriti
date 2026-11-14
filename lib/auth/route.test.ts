import { describe, expect, it, vi } from "vitest";

/**
 * Audit finding 1: Better Auth's own endpoints must not be reachable from the browser, except
 * Google's return address. If this fails, a staff session could read or reset the authenticator
 * secret without our checks (ADR 0006).
 */
const handler = vi.fn(async () => new Response("handled", { status: 200 }));
vi.mock("@/lib/auth/server", () => ({ auth: () => ({ handler }) }));

import { ALLOWED_GET_PATHS } from "@/lib/auth/allowed-paths";
const { GET, POST } = await import("@/app/api/auth/[...all]/route");

const url = (path: string) => `https://example.invalid${path}`;

describe("/api/auth", () => {
  it("lets only Google's return address and the error page through", async () => {
    expect([...ALLOWED_GET_PATHS].sort()).toEqual(["/api/auth/callback/google", "/api/auth/error"]);
    handler.mockClear();
    expect((await GET(new Request(url("/api/auth/callback/google?code=x&state=y")))).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/api/auth/get-session",
    "/api/auth/list-sessions",
    "/api/auth/two-factor/get-totp-uri",
    "/api/auth/two-factor/generate-backup-codes",
    "/api/auth/callback/google/extra",
    "/api/auth/callback/Google",
    "/api/auth/",
  ])("answers GET %s with 404 and never reaches Better Auth", async (path) => {
    handler.mockClear();
    expect((await GET(new Request(url(path)))).status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    "/api/auth/two-factor/disable",
    "/api/auth/two-factor/enable",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/sign-out",
    "/api/auth/callback/google",
  ])("answers POST %s with 404 and never reaches Better Auth", async () => {
    handler.mockClear();
    expect((await POST()).status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });
});
