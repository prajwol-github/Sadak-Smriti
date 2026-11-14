import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import file from "@/content/contributors.json";
import { contributorSchema, contributorsFileSchema } from "./schema";

const ROOT = join(import.meta.dirname, "..", "..");

describe("content/contributors.json", () => {
  const parsed = contributorsFileSchema.safeParse(file);

  it("is valid (see content/README.md for the fields)", () => {
    expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  it("has unique handles", () => {
    const handles = file.contributors.map((c) => c.handle);
    expect(handles.length).toBe(new Set(handles).size);
  });

  it("has every photo it names", () => {
    const missing = file.contributors.flatMap((c) => ("photo" in c && c.photo && !existsSync(join(ROOT, "public", c.photo as string)) ? [c.photo] : []));
    expect(missing).toEqual([]);
  });
});

describe("contributor rules", () => {
  const base = { handle: "a", name: { en: "A" }, roles: ["code"], since: "2026-11-01" };

  it("refuses links that aren't https or aren't a LinkedIn profile", () => {
    expect(contributorSchema.safeParse({ ...base, website: "http://example.org" }).success).toBe(false);
    expect(contributorSchema.safeParse({ ...base, linkedin: "https://example.org/in/a" }).success).toBe(false);
    expect(contributorSchema.safeParse({ ...base, linkedin: "https://www.linkedin.com/in/a/" }).success).toBe(true);
  });

  it("refuses hotlinked photos: they must be files on our own server", () => {
    expect(contributorSchema.safeParse({ ...base, photo: "https://media.licdn.com/x.jpg" }).success).toBe(false);
    expect(contributorSchema.safeParse({ ...base, photo: "/contributors/a.jpg" }).success).toBe(true);
  });
});
