import { describe, test, expect } from "vitest";
import {
  countryStateFromCodes,
  emptyCountryState,
  filterCountries,
  isEmpty,
  isSelected,
  parseFacets,
  selectedCodes,
  selectedCount,
  summary,
  toggleCountry,
  toSearchFacet,
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

describe("toSearchFacet", () => {
  test("empty state → empty string", () => {
    expect(toSearchFacet(emptyCountryState())).toBe("");
  });

  test("single selection → single unquoted clause", () => {
    expect(toSearchFacet(countryStateFromCodes(["DE"]))).toBe(
      "linked_data_countries:DE",
    );
  });

  test("multiple selections joined with OR in COUNTRIES order", () => {
    // COUNTRIES is sorted alphabetically by name → France, Germany, United Kingdom.
    expect(toSearchFacet(countryStateFromCodes(["GB", "DE", "FR"]))).toBe(
      "linked_data_countries:FR OR linked_data_countries:DE OR linked_data_countries:GB",
    );
  });

  test("ignores codes that aren't in COUNTRIES", () => {
    // ZZ is reserved/unassigned and not in the country-converter list.
    expect(toSearchFacet(countryStateFromCodes(["ZZ", "DE"]))).toBe(
      "linked_data_countries:DE",
    );
  });
});

describe("parseFacets", () => {
  test("empty input → empty state", () => {
    expect(isEmpty(parseFacets([]))).toBe(true);
  });

  test("single fragment with one code", () => {
    const result = parseFacets(["linked_data_countries:DE"]);
    expect(selectedCodes(result)).toEqual(["DE"]);
  });

  test("multi-code OR fragment", () => {
    const result = parseFacets([
      "linked_data_countries:DE OR linked_data_countries:FR",
    ]);
    expect(selectedCount(result)).toBe(2);
    expect(isSelected(result, "DE")).toBe(true);
    expect(isSelected(result, "FR")).toBe(true);
  });

  test("ignores concept-scheme fragments interleaved in the same array", () => {
    const result = parseFacets([
      'linked_data_concepts:"https://vocab.esea.education/X/Y"',
      "linked_data_countries:DE",
    ]);
    expect(selectedCodes(result)).toEqual(["DE"]);
  });

  test("upper-cases lower-case codes from hand-edited URLs", () => {
    const result = parseFacets(["linked_data_countries:de"]);
    expect(isSelected(result, "DE")).toBe(true);
  });

  test("round-trips through toSearchFacet", () => {
    const original = countryStateFromCodes(["DE", "FR", "GB"]);
    const fragment = toSearchFacet(original);
    const parsed = parseFacets([fragment]);
    expect([...selectedCodes(parsed)].sort()).toEqual(["DE", "FR", "GB"]);
  });
});

describe("totalSelectedCount", () => {
  test("returns 0 when no facets are applied", () => {
    expect(totalSelectedCount([])).toBe(0);
  });

  test("counts every code across all country fragments", () => {
    expect(
      totalSelectedCount([
        "linked_data_countries:DE OR linked_data_countries:FR",
        "linked_data_countries:GB",
      ]),
    ).toBe(3);
  });

  test("ignores concept-scheme fragments", () => {
    expect(
      totalSelectedCount([
        'linked_data_concepts:"https://vocab.esea.education/X/Y"',
        "linked_data_countries:DE",
      ]),
    ).toBe(1);
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
