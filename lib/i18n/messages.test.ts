import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";

/** PLAN rule 5: every user-facing string exists in both languages. */
function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(text: string): string[] {
  // Top-level ICU argument names, e.g. {deaths} and {deaths, plural, ...}
  return [...new Set([...text.matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]))].sort();
}

function get(obj: Record<string, unknown>, path: string): string {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
}

describe("messages", () => {
  it("Nepali and English have exactly the same keys", () => {
    const enKeys = new Set(keys(en));
    const neKeys = new Set(keys(ne));
    expect([...enKeys].filter((k) => !neKeys.has(k))).toEqual([]);
    expect([...neKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("no string is empty", () => {
    for (const [lang, m] of [["en", en], ["ne", ne]] as const) {
      expect(keys(m).filter((k) => !get(m, k).trim()), lang).toEqual([]);
    }
  });

  it("each translation uses the same placeholders", () => {
    const diffs = keys(en)
      .filter((k) => placeholders(get(en, k)).join() !== placeholders(get(ne, k)).join())
      .map((k) => `${k}: en ${placeholders(get(en, k))} / ne ${placeholders(get(ne, k))}`);
    expect(diffs).toEqual([]);
  });
});
