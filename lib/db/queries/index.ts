import type { AnyQuery } from "./define";
import * as crashEdit from "./crash-edit";
import * as pipeline from "./pipeline";
import * as places from "./places";
import * as rateLimit from "./rate-limit";
import * as reports from "./reports";
import * as retention from "./retention";
import * as submissions from "./submissions";
import * as system from "./system";
import * as users from "./users";

/**
 * Every registered query, by source file. A query that isn't listed here has no snapshot in
 * db/queries/ and fails `queries.test.ts`, so add each new query module below.
 */
export const QUERY_MODULES: { file: string; queries: Record<string, AnyQuery> }[] = [
  { file: "lib/db/queries/crash-edit.ts", queries: crashEdit },
  { file: "lib/db/queries/pipeline.ts", queries: pipeline },
  { file: "lib/db/queries/places.ts", queries: places },
  { file: "lib/db/queries/rate-limit.ts", queries: rateLimit },
  { file: "lib/db/queries/reports.ts", queries: reports },
  { file: "lib/db/queries/retention.ts", queries: retention },
  { file: "lib/db/queries/submissions.ts", queries: submissions },
  { file: "lib/db/queries/system.ts", queries: system },
  { file: "lib/db/queries/users.ts", queries: users },
];
