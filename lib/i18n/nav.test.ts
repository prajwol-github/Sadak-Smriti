import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every public page shows the shared site nav (PLAN section 8A, step 6). This scans
 * app/[locale]/ and fails if a page.tsx neither renders <SiteNav> nor is listed below with a reason.
 */
const EXEMPT: Record<string, string> = {
  "app/[locale]/[...rest]/page.tsx": "calls notFound(); the localised not-found.tsx renders the nav",
};

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("site nav", () => {
  const files = [...walk(join(ROOT, "app", "[locale]"))]
    .filter((p) => /[\\/]page\.tsx$/.test(p) || /[\\/]not-found\.tsx$/.test(p))
    .map((p) => ({ rel: relative(ROOT, p).replaceAll("\\", "/"), text: readFileSync(p, "utf8") }));

  it("finds the pages to check", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  for (const f of files) {
    it(`${f.rel} renders the shared nav and footer`, () => {
      if (EXEMPT[f.rel]) return;
      expect(f.text, "add <SiteNav /> (components/site/site-nav.tsx)").toMatch(/<SiteNav\b/);
      expect(f.text, "add <SiteFooter /> (components/site/site-footer.tsx)").toMatch(/<SiteFooter\b/);
    });
  }
});
