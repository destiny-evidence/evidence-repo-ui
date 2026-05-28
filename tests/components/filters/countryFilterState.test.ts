import { describe, test, expect } from "vitest";
import {
  countryStateFromCodes,
  emptyCountryState,
  filterCountries,
  isEmpty,
  isSelected,
  selectedCodes,
  selectedCount,
  summary,
  toggleCountry,
  totalSelectedCount,
} from "@/components/filters/countryFilterState";

describe("emptyCountryState", () => {
  test("starts empty", () => {
    const state = emptyCountryState();
    expect(isEmpty(state)).toBe(true);
    expect(selectedCount(state)).toBe(0);
    expect(summary(state)).toBe("");
  });
});

describe("countryStateFromCodes", () => {
  test("round-trips a list of codes through selectedCodes", () => {
    const state = countryStateFromCodes(["DE", "FR"]);
    expect(selectedCount(state)).toBe(2);
    expect(isSelected(state, "DE")).toBe(true);
    expect(isSelected(state, "FR")).toBe(true);
    expect(isSelected(state, "GB")).toBe(false);
    expect([...selectedCodes(state)].sort()).toEqual(["DE", "FR"]);
  });

  test("empty iterable is equivalent to emptyCountryState", () => {
    const state = countryStateFromCodes([]);
    expect(isEmpty(state)).toBe(true);
  });

  test("dedupes repeated codes", () => {
    const state = countryStateFromCodes(["DE", "DE", "FR"]);
    expect(selectedCount(state)).toBe(2);
  });
});

describe("summary", () => {
  test("returns N selected for one and many", () => {
    expect(summary(countryStateFromCodes(["DE"]))).toBe("1 selected");
    expect(summary(countryStateFromCodes(["DE", "FR", "GB"]))).toBe(
      "3 selected",
    );
  });
});

describe("toggleCountry", () => {
  test("adds an unselected code", () => {
    const result = toggleCountry(emptyCountryState(), "DE");
    expect(selectedCodes(result)).toEqual(["DE"]);
  });

  test("removes a selected code", () => {
    const result = toggleCountry(countryStateFromCodes(["DE"]), "DE");
    expect(isEmpty(result)).toBe(true);
  });

  test("leaves other selections untouched", () => {
    const before = countryStateFromCodes(["DE", "FR"]);
    const result = toggleCountry(before, "GB");
    expect(isSelected(result, "DE")).toBe(true);
    expect(isSelected(result, "FR")).toBe(true);
    expect(isSelected(result, "GB")).toBe(true);
  });

  test("does not mutate the input state", () => {
    const before = countryStateFromCodes(["DE"]);
    const snapshot = selectedCodes(before);
    toggleCountry(before, "FR");
    expect(selectedCodes(before)).toEqual(snapshot);
  });
});

describe("selectedCodes", () => {
  test("returns selected codes in COUNTRIES order, not insertion order", () => {
    // COUNTRIES is alphabetised by name → France, Germany, United Kingdom.
    expect(selectedCodes(countryStateFromCodes(["GB", "DE", "FR"]))).toEqual([
      "FR",
      "DE",
      "GB",
    ]);
  });

  test("ignores codes that aren't in COUNTRIES", () => {
    // ZZ is reserved/unassigned.
    expect(selectedCodes(countryStateFromCodes(["ZZ", "DE"]))).toEqual(["DE"]);
  });
});

describe("totalSelectedCount", () => {
  test("returns 0 for an empty codes array", () => {
    expect(totalSelectedCount([])).toBe(0);
  });

  test("returns the array length for non-empty input", () => {
    expect(totalSelectedCount(["DE", "FR", "GB"])).toBe(3);
  });
});

describe("filterCountries", () => {
  test("empty query returns the full input array", () => {
    const all = [
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
    ];
    expect(filterCountries("", all)).toEqual(all);
  });

  test("substring match on display name", () => {
    const all = [
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
      { code: "GB", name: "United Kingdom" },
    ];
    expect(filterCountries("ger", all)).toEqual([
      { code: "DE", name: "Germany" },
    ]);
  });

  test("case-insensitive", () => {
    const all = [{ code: "DE", name: "Germany" }];
    expect(filterCountries("GERMANY", all)).toEqual(all);
  });

  test("diacritic-insensitive: 'cote' matches Côte d'Ivoire", () => {
    const all = [
      { code: "CI", name: "Côte d'Ivoire" },
      { code: "DE", name: "Germany" },
    ];
    expect(filterCountries("cote", all)).toEqual([
      { code: "CI", name: "Côte d'Ivoire" },
    ]);
  });

  test("returns the real COUNTRIES list when no array is passed", () => {
    const result = filterCountries("germany");
    expect(result.some((c) => c.code === "DE")).toBe(true);
  });

  test("whitespace-only query is treated as empty", () => {
    const all = [{ code: "DE", name: "Germany" }];
    expect(filterCountries("   ", all)).toEqual(all);
  });
});
