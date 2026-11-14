/**
 * pnpm contributors:avatars — for each contributor with a GitHub username and no photo, downloads
 * their public GitHub avatar once into public/contributors/<handle>.<ext> and records it in
 * content/contributors.json. Visitors' browsers then load it from our own server, never from
 * GitHub (SPEC 12.2). Run by a maintainer; commit the image and the JSON change.
 *
 * LinkedIn photos are not supported: LinkedIn does not allow its images to be loaded or copied.
 * Contributors without GitHub add their own photo file instead (content/README.md).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const FILE = join(ROOT, "content", "contributors.json");
const OUT = join(ROOT, "public", "contributors");
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function main() {
  const data = JSON.parse(readFileSync(FILE, "utf8")) as { contributors: { handle: string; github?: string; photo?: string }[] };
  mkdirSync(OUT, { recursive: true });
  let changed = 0;
  for (const c of data.contributors) {
    if (!c.github || c.photo) continue;
    const res = await fetch(`https://github.com/${encodeURIComponent(c.github)}.png?size=400`, {
      headers: { "User-Agent": "sadak-smriti-contributors (open-source project)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !EXT[type]) {
      console.warn(`  ${c.handle}: no avatar (${res.status} ${type})`);
      continue;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 2_000_000) {
      console.warn(`  ${c.handle}: avatar too large, skipped`);
      continue;
    }
    const name = `${c.handle}.${EXT[type]}`;
    writeFileSync(join(OUT, name), bytes);
    c.photo = `/contributors/${name}`;
    changed++;
    console.log(`  ${c.handle}: saved ${name} (${(bytes.length / 1024).toFixed(0)} KB)`);
  }
  if (changed) writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`${changed} avatar(s) saved. Commit public/contributors/ and content/contributors.json.`);
}

void main();
