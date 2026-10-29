import { expect, it } from "vitest";
import { hdUnits, shotConcerns, shotsAffordable } from "../budget";

export function budgetFixtures() {
  it("follows the docs' HD unit table", () => {
    expect(hdUnits(0)).toBe(0);
    expect(hdUnits(1)).toBe(12);
    expect(hdUnits(4)).toBe(12);
    expect(hdUnits(5)).toBe(16);
    expect(hdUnits(8)).toBe(16);
    expect(hdUnits(12)).toBe(20);
    expect(hdUnits(16)).toBe(22);
    expect(() => hdUnits(17)).toThrow();
  });
  it("adds controls without duplicates, capped at the cheapest tier", () => {
    expect(shotConcerns(["redness", "acne"], ["redness", "texture"])).toEqual(["redness", "acne", "texture"]);
    expect(shotConcerns(["a", "b", "c", "d"], ["e"])).toEqual(["a", "b", "c", "d"]);
  });
  it("counts affordable shots", () => {
    expect(shotsAffordable(1000, 4)).toBe(83);
    expect(shotsAffordable(1000, 8)).toBe(62);
  });
}
