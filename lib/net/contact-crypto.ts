import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Reporters' optional contact details, encrypted with AES-256-GCM (SPEC 12.3, ADR 0004).
 * The key (CONTACT_ENCRYPTION_KEY, 32 bytes as hex) lives only in the environment, never in the
 * database or its backups. Stored form: "v1.<iv>.<tag>.<ciphertext>", base64url.
 */
function key(hex = process.env.CONTACT_ENCRYPTION_KEY): Buffer {
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("CONTACT_ENCRYPTION_KEY must be 64 hex characters (see .env.example)");
  return Buffer.from(hex, "hex");
}

export function encryptContact(plain: string, keyHex?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** For reviewers only (policy action `read_contact`, P1-07). */
export function decryptContact(stored: string, keyHex?: string): string {
  const [v, iv, tag, ct] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("unknown contact format");
  const decipher = createDecipheriv("aes-256-gcm", key(keyHex), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
