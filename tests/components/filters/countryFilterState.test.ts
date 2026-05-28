import { describe, test, expect } from "vitest";
import {
  countryStateFromCodes,
  emptyCountryState,
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
  test("returns selected codes in alphabetical order, not insertion order", () => {
    expect(selectedCodes(countryStateFromCodes(["GB", "DE", "FR"]))).toEqual([
      "DE",
      "FR",
      "GB",
    ]);
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
