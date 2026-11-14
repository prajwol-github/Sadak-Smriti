import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/net/ip-hash";
import { withHashedIp } from "./session-privacy";

const SECRET = "a".repeat(40);

describe("withHashedIp", () => {
  it("replaces the raw address with its hash and leaves the rest of the session alone", () => {
    process.env.IP_HASH_SECRET = SECRET;
    const out = withHashedIp({ token: "t", userId: "u", ipAddress: "203.0.113.7" });
    expect(out.ipAddress).toBe(hashIp("203.0.113.7", SECRET));
    expect(out.ipAddress).not.toContain("203.0.113.7");
    expect(out).toMatchObject({ token: "t", userId: "u" });
  });

  it("stores nothing when there is no address", () => {
    process.env.IP_HASH_SECRET = SECRET;
    expect(withHashedIp({ ipAddress: null }).ipAddress).toBeNull();
    expect(withHashedIp({ ipAddress: "" }).ipAddress).toBeNull();
  });

  it("drops the address instead of storing it raw when the hash secret is missing", () => {
    delete process.env.IP_HASH_SECRET;
    expect(withHashedIp({ ipAddress: "203.0.113.7" }).ipAddress).toBeNull();
  });

  it("does not add an address to an update that has none", () => {
    process.env.IP_HASH_SECRET = SECRET;
    expect(withHashedIp({ expiresAt: 1 })).toEqual({ expiresAt: 1 });
  });
});
