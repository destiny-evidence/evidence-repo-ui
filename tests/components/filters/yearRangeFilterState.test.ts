import { describe, test, expect } from "vitest";
import {
  validate,
  emptyYearRangeState,
  isDirty,
  summary,
  yearRangeFromParams,
} from "@/components/filters/yearRangeFilterState";

describe("emptyYearRangeState", () => {
  test("returns blank strings", () => {
    expect(emptyYearRangeState()).toEqual({ start: "", end: "" });
  });
});

describe("yearRangeFromParams", () => {
  test("number values become strings", () => {
    expect(yearRangeFromParams(2010, 2020)).toEqual({ start: "2010", end: "2020" });
  });

  test("undefined becomes empty string", () => {
    expect(yearRangeFromParams(undefined, 2020)).toEqual({ start: "", end: "2020" });
    expect(yearRangeFromParams(2010, undefined)).toEqual({ start: "2010", end: "" });
    expect(yearRangeFromParams(undefined, undefined)).toEqual({ start: "", end: "" });
  });
});

describe("validate", () => {
  test("empty state is a valid unbounded range", () => {
    const r = validate({ start: "", end: "" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBeUndefined();
    expect(r.endYear).toBeUndefined();
  });

  test("only start filled is valid", () => {
    const r = validate({ start: "1990", end: "" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBe(1990);
    expect(r.endYear).toBeUndefined();
  });

  test("only end filled is valid", () => {
    const r = validate({ start: "", end: "2000" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBeUndefined();
    expect(r.endYear).toBe(2000);
  });

  test("two-sided valid range parses", () => {
    const r = validate({ start: "2010", end: "2020" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBe(2010);
    expect(r.endYear).toBe(2020);
  });

  test("start equal to end is allowed", () => {
    const r = validate({ start: "2010", end: "2010" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBe(2010);
    expect(r.endYear).toBe(2010);
  });

  test("non-numeric start is rejected", () => {
    const result = validate({ start: "abc", end: "" });
    expect(result.ok).toBe(false);
    expect(result.startError).toMatch(/start year/i);
    expect(result.endError).toBeNull();
  });

  test("non-numeric end is rejected", () => {
    const result = validate({ start: "", end: "x" });
    expect(result.ok).toBe(false);
    expect(result.endError).toMatch(/end year/i);
    expect(result.startError).toBeNull();
  });

  test("non-integer like 1990.5 is rejected", () => {
    expect(validate({ start: "1990.5", end: "" }).ok).toBe(false);
  });

  test("zero is rejected (parseYear requires positive)", () => {
    expect(validate({ start: "0", end: "" }).ok).toBe(false);
  });

  test("fewer than 4 digits is rejected", () => {
    const result = validate({ start: "222", end: "" });
    expect(result.startError).toMatch(/4-digit/i);
  });

  test("more than 4 digits is rejected", () => {
    const result = validate({ start: "", end: "20240" });
    expect(result.endError).toMatch(/4-digit/i);
  });

  test("both fields invalid reports both errors", () => {
    const result = validate({ start: "222", end: "20" });
    expect(result.startError).toMatch(/4-digit/i);
    expect(result.endError).toMatch(/4-digit/i);
  });

  test("start greater than end is reported as a range error", () => {
    const result = validate({ start: "2020", end: "2010" });
    expect(result.rangeError).toMatch(/not exceed/i);
    expect(result.startError).toBeNull();
    expect(result.endError).toBeNull();
  });

  test("whitespace-only input is treated as empty", () => {
    const r = validate({ start: "   ", end: "2010" });
    expect(r.ok).toBe(true);
    expect(r.startYear).toBeUndefined();
    expect(r.endYear).toBe(2010);
  });
});

describe("summary", () => {
  test("empty state → empty string", () => {
    expect(summary({ start: "", end: "" })).toBe("");
  });

  test("two-sided range", () => {
    expect(summary({ start: "2010", end: "2020" })).toBe("2010–2020");
  });

  test("only start → 'from'", () => {
    expect(summary({ start: "2010", end: "" })).toBe("from 2010");
  });

  test("only end → 'to'", () => {
    expect(summary({ start: "", end: "2020" })).toBe("to 2020");
  });

  test("invalid state → empty string (no misleading chip)", () => {
    expect(summary({ start: "abc", end: "" })).toBe("");
    expect(summary({ start: "2020", end: "2010" })).toBe("");
  });
});

describe("isDirty", () => {
  test("matches applied → not dirty", () => {
    expect(isDirty({ start: "2010", end: "2020" }, 2010, 2020)).toBe(false);
  });

  test("empty matches undefined applied → not dirty", () => {
    expect(isDirty({ start: "", end: "" }, undefined, undefined)).toBe(false);
  });

  test("any change → dirty", () => {
    expect(isDirty({ start: "2011", end: "2020" }, 2010, 2020)).toBe(true);
    expect(isDirty({ start: "2010", end: "" }, 2010, 2020)).toBe(true);
  });

  test("invalid state is always dirty (so reset is reachable)", () => {
    expect(isDirty({ start: "abc", end: "" }, undefined, undefined)).toBe(true);
  });
});
