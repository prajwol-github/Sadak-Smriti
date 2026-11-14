import { describe, expect, it } from "vitest";
import { formDataToInput, normalizeUrl, parseReport } from "./report";

const TODAY = "2026-11-13"; // 27 Kartik 2083
const DISTRICT = "0199c8a0-0000-7000-8000-000000000001";

const base = {
  calendar: "ad",
  adDate: "2026-11-12",
  districtId: DISTRICT,
  killed: "3",
  witness: "I saw a bus leave the road near the bridge.",
};

describe("parseReport", () => {
  it("accepts the smallest valid report", () => {
    const r = parseReport(base, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.report).toMatchObject({ occurredOn: "2026-11-12", killed: 3, injured: 0, source: { kind: "witness" } });
    }
  });

  it("converts a BS date (26 Kartik 2083 = 12 Nov 2026)", () => {
    const r = parseReport({ ...base, calendar: "bs", adDate: undefined, bsYear: "2083", bsMonth: "7", bsDay: "26" }, TODAY);
    expect(r.ok && r.report.occurredOn).toBe("2026-11-12");
  });

  it("refuses a BS day that doesn't exist", () => {
    const r = parseReport({ ...base, calendar: "bs", bsYear: "2083", bsMonth: "7", bsDay: "33" }, TODAY);
    expect(!r.ok && r.errors.date).toBe("date");
  });

  it("refuses a future date and one more than 20 years ago", () => {
    expect(parseReport({ ...base, adDate: "2026-11-14" }, TODAY)).toMatchObject({ ok: false, errors: { date: "dateFuture" } });
    expect(parseReport({ ...base, adDate: "2005-01-01" }, TODAY)).toMatchObject({ ok: false, errors: { date: "dateOld" } });
  });

  it("refuses counts outside 0–200 and non-whole numbers", () => {
    for (const killed of ["-1", "201", "2.5", "many"]) {
      expect(parseReport({ ...base, killed }, TODAY)).toMatchObject({ ok: false, errors: { killed: "killed" } });
    }
  });

  it("needs a news link or a witness statement", () => {
    expect(parseReport({ ...base, witness: undefined }, TODAY)).toMatchObject({ ok: false, errors: { source: "source" } });
    const withLink = parseReport({ ...base, witness: undefined, sourceUrl: "https://www.example.com/news/1?utm_source=fb" }, TODAY);
    expect(withLink.ok && withLink.report.source).toEqual({
      kind: "news", url: "https://www.example.com/news/1?utm_source=fb", normalizedUrl: "example.com/news/1",
    });
  });

  it("refuses links that aren't web pages", () => {
    expect(parseReport({ ...base, sourceUrl: "javascript:alert(1)" }, TODAY)).toMatchObject({ ok: false, errors: { sourceUrl: "url" } });
  });

  it("limits text lengths", () => {
    expect(parseReport({ ...base, witness: "x".repeat(1001) }, TODAY)).toMatchObject({ ok: false, errors: { witness: "tooLong" } });
    expect(parseReport({ ...base, placeName: "x".repeat(121) }, TODAY)).toMatchObject({ ok: false, errors: { placeName: "tooLong" } });
  });

  it("accepts an email or phone as contact, and nothing else", () => {
    expect(parseReport({ ...base, contact: "someone@example.org" }, TODAY).ok).toBe(true);
    expect(parseReport({ ...base, contact: "+977 98 0000 0000" }, TODAY).ok).toBe(true);
    expect(parseReport({ ...base, contact: "call me" }, TODAY)).toMatchObject({ ok: false, errors: { contact: "contact" } });
  });

  it("needs a district", () => {
    expect(parseReport({ ...base, districtId: undefined }, TODAY)).toMatchObject({ ok: false, errors: { districtId: "district" } });
  });
});

describe("helpers", () => {
  it("normalises links for duplicate checks", () => {
    expect(normalizeUrl("https://www.Example.com/a/b/?fbclid=1&id=7#x")).toBe("example.com/a/b?id=7");
    expect(normalizeUrl("ftp://example.com/a")).toBeNull();
  });

  it("reads FormData: blanks are omitted, vehicles repeat, Next's $ fields are ignored", () => {
    const fd = new FormData();
    fd.append("killed", "2");
    fd.append("placeName", "  ");
    fd.append("vehicles", "bus");
    fd.append("vehicles", "truck");
    fd.append("$ACTION_ID_abc", "");
    expect(formDataToInput(fd)).toEqual({ killed: "2", vehicles: ["bus", "truck"] });
  });
});
