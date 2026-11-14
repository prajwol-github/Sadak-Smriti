import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // *.db.test.ts need the local database (pnpm db:up) and run with `pnpm test:db`.
    include: process.env.DB_TESTS ? ["**/*.db.test.ts"] : ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**", "spike/**", ...(process.env.DB_TESTS ? [] : ["**/*.db.test.ts"])],
    environment: "node",
    // Database tests share one database; run their files one at a time.
    fileParallelism: !process.env.DB_TESTS,
  },
});
