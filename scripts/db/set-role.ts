/**
 * pnpm users:role <email> <role> — the only way to make someone a reviewer or an admin (ADR 0006).
 *
 *   pnpm users:role someone@example.org reviewer
 *   pnpm users:role someone@example.org contributor     # take the role away
 *   pnpm users:role someone@example.org                 # show the current role
 *
 * Run it on the server. It connects as `migrator` (MIGRATOR_DATABASE_URL), the only database role
 * that may write users.role, so nobody can do this from the website or without the server's
 * credentials. The person must have signed in with Google once first. The change is written to
 * audit_log and their sessions are ended, so the new role applies at their next sign-in. A new
 * reviewer or admin sets up an authenticator app the first time they open /review.
 */
import { insertAudit } from "../../lib/db/queries/reports";
import { endUserSessions, setUserRole, userByEmail } from "../../lib/db/queries/users";
import { openDatabase } from "../../lib/db/standalone";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // The server sets the variables directly.
}

const ROLES = ["contributor", "trusted", "reviewer", "admin"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || (role && !ROLES.includes(role as Role))) {
    console.error(`Usage: pnpm users:role <email> [${ROLES.join("|")}]`);
    process.exitCode = 1;
    return;
  }

  const db = openDatabase(process.env.MIGRATOR_DATABASE_URL, { max: 1 });
  try {
    const [user] = await db.run(userByEmail, { email });
    if (!user) {
      console.error("No account with that email. They must sign in with Google once first.");
      process.exitCode = 1;
      return;
    }
    if (!role) {
      console.log(`${user.email}: ${user.role}${user.twoFactorEnabled ? " (authenticator app set up)" : ""}`);
      return;
    }
    if (role === user.role) {
      console.log(`${user.email} is already ${role}.`);
      return;
    }
    await db.exec.transaction(async (tx) => {
      await setUserRole.build(tx, { userId: user.id, role: role as Role });
      await endUserSessions.build(tx, { userId: user.id });
      // No actor: the change was made on the server, not by a signed-in user.
      await insertAudit.build(tx, {
        actorId: null, action: "user.role_change", targetType: "user", targetId: user.id,
        after: { from: user.role, to: role, via: "pnpm users:role" }, ipHash: null,
      });
    });
    console.log(`${user.email}: ${user.role} → ${role}. They are signed out and get the new role when they sign in again.`);
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
