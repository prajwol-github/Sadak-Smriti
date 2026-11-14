/**
 * Cloudflare Turnstile, checked on the server (SPEC 11.2, 12.2).
 * Development uses Cloudflare's published test keys, which always pass. We don't send the
 * visitor's IP to Cloudflare (the optional `remoteip` field), only the token.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's published dummy secrets (always pass, always fail, token already spent). */
const TEST_SECRET = /^[123]x0{20,}AA$/;

/**
 * In production a test secret would let every robot through, so refuse to check anything at all
 * (audit finding 8). `env` is injectable for tests.
 */
export function assertRealSecret(secret: string, env: string | undefined = process.env.NODE_ENV): void {
  if (env === "production" && TEST_SECRET.test(secret)) {
    throw new Error("TURNSTILE_SECRET_KEY is one of Cloudflare's test keys; create a real widget (docs/runbooks/deploy.md part 8)");
  }
}

export async function verifyTurnstile(token: string | null, secret = process.env.TURNSTILE_SECRET_KEY): Promise<boolean> {
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is not set (see .env.example)");
  assertRealSecret(secret);
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare unreachable: refuse, and the form asks the visitor to try again.
    return false;
  }
}
