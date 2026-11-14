import { describe, expect, it } from "vitest";
import { matchDistrict, similarity, spellingKey } from "./match";

describe("spellingKey", () => {
  it.each([
    ["Shivasataxi", "Shivasatakshi"],
    ["Triveni", "Tribeni"],
    ["Bhimeshwor", "Bhimeswor"],
    ["Gauriganj", "Gaurigunj"],
    ["Galchi", "Galchhi"],
    ["Laxmipur Patari", "Lakshmipur Patari"],
    ["Phalelung", "Falelung"],
  ])("folds %s and %s together", (a, b) => {
    expect(spellingKey(a)).toBe(spellingKey(b));
  });

  it("keeps different places apart", () => {
    expect(spellingKey("Kathmandu")).not.toBe(spellingKey("Kirtipur"));
  });
});

describe("matchDistrict", () => {
  it("pairs by name first, then the last one left as a renamed unit", () => {
    const { matches, unmatched } = matchDistrict(
      [
        { name: "Shivasataxi", area: 147 },
        { name: "Diprung", area: 99 },
        { name: "Old Name", area: 210 },
      ],
      [
        { code: 1, name: "Shivasatakshi", area: 146 },
        { code: 2, name: "Diprung Chuichumma", area: 100 },
        { code: 3, name: "New Name", area: 205 },
      ],
    );
    expect(unmatched.boundaries).toEqual([]);
    expect(matches.map((m) => [m.boundary.name, m.unit.code, m.stage])).toEqual([
      ["Shivasataxi", 1, "spelling"],
      ["Diprung", 2, "contains"],
      ["Old Name", 3, "renamed"],
    ]);
  });

  it("pairs several renamed units by size only when every area agrees", () => {
    const ok = matchDistrict(
      [{ name: "Alpha", area: 100 }, { name: "Beta", area: 300 }],
      [{ code: 1, name: "Omega", area: 310 }, { code: 2, name: "Sigma", area: 95 }],
    );
    expect(ok.matches.map((m) => [m.boundary.name, m.unit.code, m.stage])).toEqual([["Alpha", 2, "area"], ["Beta", 1, "area"]]);

    const refused = matchDistrict(
      [{ name: "Alpha", area: 100 }, { name: "Beta", area: 300 }],
      [{ code: 1, name: "Omega", area: 600 }, { code: 2, name: "Sigma", area: 95 }],
    );
    expect(refused.matches).toEqual([]);
    expect(refused.unmatched.units).toHaveLength(2);
  });

  it("measures similarity between 0 and 1", () => {
    expect(similarity("abc", "abc")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
  });
});
