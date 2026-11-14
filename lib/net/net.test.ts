import { describe, expect, it } from "vitest";
import { decryptContact, encryptContact } from "./contact-crypto";
import { clientIp, hashIp } from "./ip-hash";
import { windows } from "./rate-limit";
import { assertRealSecret } from "./turnstile";

const SECRET = "a".repeat(64);
const KEY = "0123456789abcdef".repeat(4);

describe("IP hashing", () => {
  it("prefers Cloudflare's header and never returns the raw IP from hashIp", () => {
    const h = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.7");
    const hashed = hashIp("203.0.113.7", SECRET);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toContain("203.0.113.7");
    expect(hashIp("203.0.113.7", SECRET)).toBe(hashed); // stable, so limits can count
    expect(hashIp("203.0.113.7", "b".repeat(64))).not.toBe(hashed); // depends on the secret
  });

  it("refuses to hash without a proper secret", () => {
    expect(() => hashIp("1.2.3.4", "short")).toThrow();
  });
});

describe("contact encryption", () => {
  it("round-trips, and the stored text contains no part of the contact", () => {
    const stored = encryptContact("someone@example.org", KEY);
    expect(stored).not.toContain("someone");
    expect(decryptContact(stored, KEY)).toBe("someone@example.org");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptContact("x", KEY)).not.toBe(encryptContact("x", KEY));
  });

  it("fails with the wrong key", () => {
    expect(() => decryptContact(encryptContact("x", KEY), "f".repeat(64))).toThrow();
  });
});

describe("rate-limit windows", () => {
  it("uses the UTC hour and Nepal's calendar day", () => {
    // 2026-11-13 20:30 UTC is 14 Nov 02:15 in Nepal.
    const w = windows(new Date("2026-11-13T20:30:00Z"));
    expect(w.hour.toISOString()).toBe("2026-11-13T20:00:00.000Z");
    expect(w.day.toISOString()).toBe("2026-11-13T18:15:00.000Z");
  });
});

describe("assertRealSecret (audit finding 8)", () => {
  const TEST_KEY = "1x0000000000000000000000000000000AA";

  it("refuses Cloudflare's test secrets in production", () => {
    for (const k of ["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"]) {
      expect(() => assertRealSecret(k, "production")).toThrow(/test keys/);
    }
  });

  it("allows them in development and tests, and allows a real-looking secret in production", () => {
    expect(() => assertRealSecret(TEST_KEY, "development")).not.toThrow();
    expect(() => assertRealSecret(TEST_KEY, "test")).not.toThrow();
    expect(() => assertRealSecret("0x4AAAAAAAexampleexampleexample_example1234", "production")).not.toThrow();
  });
});
