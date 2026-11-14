import { describe, expect, it } from "vitest";
import { paginate, parsePage } from "./paginate";

const rows = Array.from({ length: 13 }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the first page", () => {
    expect(paginate(rows, 1, 5)).toEqual({ rows: [1, 2, 3, 4, 5], total: 13, page: 1, pageSize: 5, pageCount: 3 });
  });
  it("returns a short last page", () => {
    expect(paginate(rows, 3, 5).rows).toEqual([11, 12, 13]);
  });
  it("clamps a page past the end to the last page", () => {
    expect(paginate(rows, 99, 5).page).toBe(3);
  });
  it("clamps a page below 1 to the first page", () => {
    expect(paginate(rows, 0, 5).page).toBe(1);
  });
  it("has one empty page when there are no rows", () => {
    expect(paginate([], 1, 5)).toEqual({ rows: [], total: 0, page: 1, pageSize: 5, pageCount: 1 });
  });
});

describe("parsePage", () => {
  it("reads a whole number", () => expect(parsePage("2")).toBe(2));
  it("uses the first of repeated values", () => expect(parsePage(["3", "4"])).toBe(3));
  it.each([undefined, "", "0", "-1", "1.5", "abc", "NaN", "Infinity"])("falls back to 1 for %j", (v) => {
    expect(parsePage(v)).toBe(1);
  });
});
