// Captures pages at phone and desktop widths, and reports console errors and failed requests.
// Usage: node scripts/dev/screenshot.mjs <outDir> <url> [url...]
// Env: WIDTHS="390,1440" (default), WAIT_MS=1500, FULL=1 for full-page shots,
//      WAIT_UNTIL=load for pages that keep a connection open (the report form's captcha).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir, ...urls] = process.argv.slice(2);
if (!outDir || urls.length === 0) {
  console.error("usage: node scripts/dev/screenshot.mjs <outDir> <url> [url...]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const widths = (process.env.WIDTHS ?? "390,1440").split(",").map(Number);
const waitMs = Number(process.env.WAIT_MS ?? 1500);

const browser = await chromium.launch();
let problems = 0;
for (const url of urls) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => errors.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
    page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
    await page.goto(url, { waitUntil: process.env.WAIT_UNTIL === "load" ? "load" : "networkidle" });
    await page.waitForTimeout(waitMs);
    const name = `${url.replace(/^https?:\/\/[^/]+/, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}-${width}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: process.env.FULL === "1" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${name}${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ""}`);
    for (const e of errors) console.log(`   ${e}`);
    problems += errors.length + (overflow > 0 ? 1 : 0);
    await page.close();
  }
}
await browser.close();
process.exit(problems ? 1 : 0);
