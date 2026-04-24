import { describe, test, expect } from "vitest";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  type SearchParams,
} from "@/services/searchParams";

describe("parseSearchParams", () => {
  test("empty search → defaults", () => {
    expect(parseSearchParams("")).toEqual({
      q: "",
      page: 1,
      startYear: undefined,
      endYear: undefined,
    });
  });

  test("full params round-trip", () => {
    const input = "?q=phonics&page=3&start_year=2010&end_year=2024";
    expect(parseSearchParams(input)).toEqual({
      q: "phonics",
      page: 3,
      startYear: 2010,
      endYear: 2024,
    });
  });

  test("leading ? is optional", () => {
    expect(parseSearchParams("q=x").q).toBe("x");
    expect(parseSearchParams("?q=x").q).toBe("x");
  });

  test("non-numeric page → 1", () => {
    expect(parseSearchParams("?page=abc").page).toBe(1);
  });

  test("non-numeric years → undefined", () => {
    const p = parseSearchParams("?start_year=abc&end_year=xyz");
    expect(p.startYear).toBeUndefined();
    expect(p.endYear).toBeUndefined();
  });

  test.each([
    { label: "zero",                raw: "0" },
    { label: "negative value",      raw: "-5" },
    { label: "scientific notation", raw: "1e3" },
    { label: "hex notation",        raw: "0x10" },
    { label: "fractional value",    raw: "2.5" },
  ])("page = $raw ($label) falls back to 1", ({ raw }) => {
    expect(parseSearchParams(`?page=${raw}`).page).toBe(1);
  });

  test("year = 0 → undefined (matches SearchBar year > 0 rule)", () => {
    const p = parseSearchParams("?start_year=0&end_year=0");
    expect(p.startYear).toBeUndefined();
    expect(p.endYear).toBeUndefined();
  });

  test("year with scientific notation → undefined (strict decimal only)", () => {
    expect(parseSearchParams("?start_year=2.024e3").startYear).toBeUndefined();
  });

  test("inverted year range → both dropped", () => {
    const p = parseSearchParams("?start_year=2024&end_year=2010");
    expect(p.startYear).toBeUndefined();
    expect(p.endYear).toBeUndefined();
  });

  test("q is trimmed", () => {
    expect(parseSearchParams("?q=%20%20hello%20%20").q).toBe("hello");
  });
});

describe("toQueryString", () => {
  test("omits defaults", () => {
    const p: SearchParams = { q: "", page: 1, startYear: undefined, endYear: undefined };
    expect(toQueryString(p)).toBe("");
  });

  test("fixed key order: q, start_year, end_year, page", () => {
    const p: SearchParams = { q: "phonics", page: 3, startYear: 2010, endYear: 2024 };
    expect(toQueryString(p)).toBe("q=phonics&start_year=2010&end_year=2024&page=3");
  });

  test("page=1 (default) is dropped from output, q is kept", () => {
    const p: SearchParams = { q: "phonics", page: 1, startYear: undefined, endYear: undefined };
    expect(toQueryString(p)).toBe("q=phonics");
  });

  test("URL-encodes q", () => {
    const p: SearchParams = { q: "a b&c", page: 1, startYear: undefined, endYear: undefined };
    expect(toQueryString(p)).toBe("q=a+b%26c");
  });

  test("round-trip normalization", () => {
    const raw = "?page=abc&q=%20hello%20&start_year=2024&end_year=2010";
    const canonical = toQueryString(parseSearchParams(raw));
    expect(canonical).toBe("q=hello");
  });
});

describe("buildSearchUrl", () => {
  test("empty params → bare slug path", () => {
    const p: SearchParams = { q: "", page: 1, startYear: undefined, endYear: undefined };
    expect(buildSearchUrl("esea", p)).toBe("/esea");
  });

  test("with params → slug + querystring", () => {
    const p: SearchParams = { q: "phonics", page: 2, startYear: undefined, endYear: undefined };
    expect(buildSearchUrl("esea", p)).toBe("/esea?q=phonics&page=2");
  });
});
