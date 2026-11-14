import { createHmac } from "node:crypto";

/**
 * The visitor's IP, hashed (SPEC 12.3: IPs are kept only as salted hashes, 30 days).
 *
 * `CF-Connecting-IP` is trustworthy only once the server accepts traffic from Cloudflare alone
 * (PLAN P0-14). Before that (development), it falls back to the first X-Forwarded-For entry.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function hashIp(ip: string, secret = process.env.IP_HASH_SECRET): string {
  if (!secret || secret.length < 32) throw new Error("IP_HASH_SECRET is missing or too short (see .env.example)");
  return createHmac("sha256", secret).update(ip).digest("hex");
}
