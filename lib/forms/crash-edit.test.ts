import { describe, expect, it } from "vitest";
import { effectiveNameVisibility, parseCrashFacts, parseNewsLink, parsePerson, parsePublish, parseReasonOnly, type Raw } from "./crash-edit";

// Every value here is invented.
const NOW = new Date("2026-11-14T06:00:00Z");
const DISTRICT = "0199c8a0-0000-7000-8000-00000000000a";
const facts = (over: Raw = {}): Raw => ({
  version: "2", reason: "Corrected from the police report", titleEn: "Bus fell off the road", titleNp: "", occurredOn: "2026-11-12",
  occurredTime: "05:45", placeNameEn: "Example bazaar", placeNameNp: "", districtId: DISTRICT, deaths: "3", injured: "5", vehicles: ["bus", "bus", "motorcycle"], ...over,
});
const errorsOf = (r: ReturnType<typeof parseCrashFacts>) => (r.ok ? {} : r.errors);

describe("parseCrashFacts", () => {
  it("accepts a good form, trims, drops empty text and repeated vehicles", () => {
    const r = parseCrashFacts(facts({ placeNameEn: "  Example   bazaar " }), NOW);
    expect(r).toEqual({
      ok: true,
      value: {
        version: 2, reason: "Corrected from the police report", titleEn: "Bus fell off the road", titleNp: null, occurredOn: "2026-11-12",
        occurredTime: "05:45", placeNameEn: "Example bazaar", placeNameNp: null, districtId: DISTRICT, deaths: 3, injured: 5, vehicles: ["bus", "motorcycle"],
      },
    });
  });

  it("injured may be left empty, and a single vehicle arrives as a string", () => {
    const r = parseCrashFacts(facts({ injured: "", occurredTime: "", vehicles: "jeep" }), NOW);
    expect(r.ok && r.value).toMatchObject({ injured: null, occurredTime: null, vehicles: ["jeep"] });
  });

  it.each([
    ["deaths", "-1", "number"], ["deaths", "1.5", "number"], ["deaths", "abc", "number"], ["deaths", "1001", "number"], ["deaths", "", "required"],
    ["injured", "5001", "number"], ["occurredOn", "2026-02-30", "date"], ["occurredOn", "12/11/2026", "date"], ["occurredOn", "1999-12-31", "date"],
    ["occurredOn", "2026-11-15", "future"], ["occurredTime", "25:00", "time"], ["occurredTime", "5:45", "time"],
    ["districtId", "not-a-uuid", "required"], ["reason", "ok", "reason"], ["reason", "", "reason"], ["titleEn", "x".repeat(201), "tooLong"], ["version", "0", "invalid"],
  ])("refuses %s = %j with %s", (field, value, code) => {
    expect(errorsOf(parseCrashFacts(facts({ [field]: value }), NOW))[field]).toBe(code);
  });

  it("today in Nepal is allowed, tomorrow is not", () => {
    expect(parseCrashFacts(facts({ occurredOn: "2026-11-14" }), NOW).ok).toBe(true);
    expect(errorsOf(parseCrashFacts(facts({ occurredOn: "2026-11-15" }), NOW)).occurredOn).toBe("future");
  });

  it("refuses an unknown vehicle", () => {
    expect(errorsOf(parseCrashFacts(facts({ vehicles: ["bus", "spaceship"] }), NOW)).vehicles).toBe("invalid");
  });
});

const person = (over: Raw = {}): Raw => ({
  version: "1", reason: "Named in the police statement", status: "killed", nameEn: "Example Person", nameNp: "", age: "34", sex: "female", roadUser: "passenger",
  hometownText: "Example village", nameVisibility: "public", publication: "draft", ...over,
});

describe("parsePerson", () => {
  it("accepts a person; version is only needed to edit", () => {
    expect(parsePerson(person({ version: undefined }), "add").ok).toBe(true);
    const edit = parsePerson(person(), "edit");
    expect(edit.ok && edit.value.version).toBe(1);
  });

  it("needs a name in at least one script", () => {
    expect(parsePerson(person({ nameEn: "", nameNp: "" }), "add")).toMatchObject({ ok: false, errors: { nameEn: "name" } });
    expect(parsePerson(person({ nameEn: "", nameNp: "उदाहरण व्यक्ति" }), "add").ok).toBe(true);
  });

  it.each([
    ["status", "dead", "invalid"], ["status", "", "required"], ["age", "121", "number"], ["age", "-3", "number"], ["sex", "x", "invalid"],
    ["roadUser", "astronaut", "invalid"], ["reason", "no", "reason"], ["nameEn", "x".repeat(121), "tooLong"],
  ])("refuses %s = %j with %s", (field, value, code) => {
    const r = parsePerson(person({ [field]: value }), "add");
    expect(r.ok ? {} : r.errors).toMatchObject({ [field]: code });
  });

  it("age, sex, road user and hometown are optional", () => {
    const r = parsePerson(person({ age: "", sex: "", roadUser: "", hometownText: "" }), "add");
    expect(r.ok && r.value).toMatchObject({ age: null, sex: null, roadUser: null, hometownText: null });
  });

  it("defaults to a public name and a draft", () => {
    const r = parsePerson(person({ nameVisibility: undefined, publication: undefined }), "add");
    expect(r.ok && r.value).toMatchObject({ nameVisibility: "public", publication: "draft" });
  });
});

describe("effectiveNameVisibility (injured children are hidden by default)", () => {
  const p = (over = {}) => ({ status: "injured" as const, age: 10, nameVisibility: "public" as const, familyAskedToShow: false, ...over });
  it("hides an injured child", () => expect(effectiveNameVisibility(p())).toBe("hidden"));
  it("shows an injured child when the family asked", () => expect(effectiveNameVisibility(p({ familyAskedToShow: true }))).toBe("public"));
  it("an injured adult follows the choice", () => {
    expect(effectiveNameVisibility(p({ age: 18 }))).toBe("public");
    expect(effectiveNameVisibility(p({ age: 18, nameVisibility: "hidden" }))).toBe("hidden");
  });
  it("a child who was killed follows the choice (the rule is for injured people)", () => {
    expect(effectiveNameVisibility(p({ status: "killed" }))).toBe("public");
  });
  it("an unknown age is not assumed to be a child", () => expect(effectiveNameVisibility(p({ age: null }))).toBe("public"));
});

describe("parseNewsLink", () => {
  it("normalises the link", () => {
    const r = parseNewsLink({ url: "http://www.Example.com/news/1/?utm_source=x", reason: "Follow-up article" });
    expect(r.ok && r.value.normalizedUrl).toBe("example.com/news/1"); // the same form the report form stores
  });
  it.each(["", "not a link", "javascript:alert(1)", "ftp://example.com/x"])("refuses %j", (url) => {
    expect(parseNewsLink({ url, reason: "Follow-up article" })).toMatchObject({ ok: false, errors: { url: "url" } });
  });
  it("needs a reason", () => {
    expect(parseNewsLink({ url: "https://example.com/a", reason: "" })).toMatchObject({ ok: false, errors: { reason: "reason" } });
  });
});

describe("parseReasonOnly and parsePublish", () => {
  it("need a reason", () => {
    expect(parseReasonOnly({ reason: "" })).toMatchObject({ ok: false, errors: { reason: "reason" } });
    expect(parseReasonOnly({ reason: "Entered twice" })).toEqual({ ok: true, value: { reason: "Entered twice" } });
  });
  it("publish also needs the version, and reads the direction", () => {
    expect(parsePublish({ reason: "Checked the article", version: "3", publish: "true" })).toEqual({ ok: true, value: { version: 3, reason: "Checked the article", publish: true } });
    expect(parsePublish({ reason: "Family asked", version: "3", publish: "false" })).toMatchObject({ ok: true, value: { publish: false } });
    expect(parsePublish({ reason: "Family asked", version: "x", publish: "false" })).toMatchObject({ ok: false, errors: { version: "invalid" } });
  });
});
