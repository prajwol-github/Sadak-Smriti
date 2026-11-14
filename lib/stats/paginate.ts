/** A page of rows plus what a pager needs. Plain data, so it can be cached and serialised. */
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Reads `?page=` safely: anything that is not a whole number of 1 or more becomes 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Slices `rows` into one page. A page past the end is clamped to the last page, so a stale link
 * shows the last rows instead of an empty list. The database version of a list query does the
 * same with LIMIT/OFFSET and a count, and returns the same shape.
 */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length, page: current, pageSize, pageCount };
}
