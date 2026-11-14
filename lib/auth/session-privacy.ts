import { hashIp } from "@/lib/net/ip-hash";

/**
 * SPEC 12.3: an IP address is kept only as a salted hash. Better Auth writes the raw address of
 * every sign-in into `sessions.ip_address`; this swaps it for the hash before the row is saved
 * (audit finding 6). It is wired in lib/auth/server.ts as a database hook. Better Auth's own rate
 * limit still reads the real address from the request, so nothing is lost.
 *
 * Without IP_HASH_SECRET (a fresh checkout) the address is dropped rather than stored raw.
 */
export function withHashedIp<T extends object>(session: T): T {
  const raw = (session as { ipAddress?: unknown }).ipAddress;
  const ip = typeof raw === "string" && raw ? raw : null;
  if (!("ipAddress" in session)) return session;
  let stored: string | null = null;
  if (ip) {
    try {
      stored = hashIp(ip);
    } catch {
      stored = null;
    }
  }
  return { ...session, ipAddress: stored };
}
