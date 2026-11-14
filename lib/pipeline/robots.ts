/**
 * robots.txt, enough to honour an outlet that asks us not to collect (SPEC 7.2 "polite
 * collection"). Uses the group for our bot's name if there is one, otherwise the `*` group; the
 * longest matching rule wins, and Allow wins a tie (RFC 9309).
 */
export function isAllowedByRobots(robotsTxt: string, botToken: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; prefix: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", prefix: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const token = botToken.toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && token.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;

  let best: { allow: boolean; length: number } | null = null;
  for (const r of group.rules) {
    const pattern = r.prefix.endsWith("$") ? r.prefix.slice(0, -1) : r.prefix;
    const re = new RegExp(`^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${r.prefix.endsWith("$") ? "$" : ""}`);
    if (!re.test(path)) continue;
    const length = r.prefix.length;
    if (!best || length > best.length || (length === best.length && r.allow)) best = { allow: r.allow, length };
  }
  return best ? best.allow : true;
}
