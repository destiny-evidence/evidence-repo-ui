import { describe, test, expect } from "vitest";
import {
  commit,
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

describe("commit", () => {
  test("empty state is a valid unbounded range", () => {
    expect(commit({ start: "", end: "" })).toEqual({
      ok: true,
      startYear: undefined,
      endYear: undefined,
    });
  });

  test("only start filled is valid", () => {
    expect(commit({ start: "1990", end: "" })).toEqual({
      ok: true,
      startYear: 1990,
      endYear: undefined,
    });
  });

  test("only end filled is valid", () => {
    expect(commit({ start: "", end: "2000" })).toEqual({
      ok: true,
      startYear: undefined,
      endYear: 2000,
    });
  });

  test("two-sided valid range parses", () => {
    expect(commit({ start: "2010", end: "2020" })).toEqual({
      ok: true,
      startYear: 2010,
      endYear: 2020,
    });
  });

  test("start equal to end is allowed", () => {
    expect(commit({ start: "2010", end: "2010" })).toEqual({
      ok: true,
      startYear: 2010,
      endYear: 2010,
    });
  });

  test("non-numeric start is rejected", () => {
    const result = commit({ start: "abc", end: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/start year/i);
  });

  test("non-numeric end is rejected", () => {
    const result = commit({ start: "", end: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/end year/i);
  });

  test("non-integer like 1990.5 is rejected", () => {
    const result = commit({ start: "1990.5", end: "" });
    expect(result.ok).toBe(false);
  });

  test("zero is rejected (parseYear requires positive)", () => {
    const result = commit({ start: "0", end: "" });
    expect(result.ok).toBe(false);
  });

  test("start greater than end is rejected", () => {
    const result = commit({ start: "2020", end: "2010" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not exceed/i);
  });

  test("whitespace-only input is treated as empty", () => {
    expect(commit({ start: "   ", end: "2010" })).toEqual({
      ok: true,
      startYear: undefined,
      endYear: 2010,
    });
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
