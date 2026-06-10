import { describe, test, expect } from "vitest";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  toUnpaginatedSearchQuery,
} from "@/services/searchParams";
import { makeSearchParams } from "../fixtures";

describe("parseSearchParams", () => {
  test("empty search → defaults", () => {
    expect(parseSearchParams("")).toEqual({
      q: "",
      page: 1,
      startYear: undefined,
      endYear: undefined,
      sort: undefined,
      conceptFilters: [],
      countryCodes: [],
    });
  });

  test("full params round-trip", () => {
    const input = "?q=phonics&page=3&start_year=2010&end_year=2024&sort=newest";
    expect(parseSearchParams(input)).toEqual({
      q: "phonics",
      page: 3,
      startYear: 2010,
      endYear: 2024,
      sort: "newest",
      conceptFilters: [],
      countryCodes: [],
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

  test("page that overflows safe integer range → 1 (no Infinity leak)", () => {
    const huge = "9".repeat(100);
    const p = parseSearchParams(`?page=${huge}`);
    expect(p.page).toBe(1);
    expect(Number.isFinite(p.page)).toBe(true);
  });

  test("years that overflow safe integer range → undefined (no Infinity leak)", () => {
    const huge = "9".repeat(100);
    const p = parseSearchParams(`?start_year=${huge}&end_year=${huge}`);
    expect(p.startYear).toBeUndefined();
    expect(p.endYear).toBeUndefined();
  });

  test("q is trimmed", () => {
    expect(parseSearchParams("?q=%20%20hello%20%20").q).toBe("hello");
  });

  test.each([
    { label: "newest", raw: "newest", expected: "newest" as const },
    { label: "oldest", raw: "oldest", expected: "oldest" as const },
  ])("sort=$label is accepted", ({ raw, expected }) => {
    expect(parseSearchParams(`?sort=${raw}`).sort).toBe(expected);
  });

  test.each([
    { label: "garbage",   raw: "garbage" },
    { label: "relevance", raw: "relevance" },
    { label: "empty",     raw: "" },
    { label: "uppercase", raw: "NEWEST" },
    { label: "wire form", raw: "-publication_year" },
  ])("sort=$label → undefined (strict whitelist)", ({ raw }) => {
    expect(parseSearchParams(`?sort=${raw}`).sort).toBeUndefined();
  });
});

describe("parseSearchParams concept filters", () => {
  test("single concept= param → one group with one URI", () => {
    const url = "?concept=https://vocab.esea.education/A/C001";
    expect(parseSearchParams(url).conceptFilters).toEqual([
      ["https://vocab.esea.education/A/C001"],
    ]);
  });

  test("comma-separated value → one group with multiple URIs (sibling OR)", () => {
    const url =
      "?concept=https://vocab.esea.education/A/C001,https://vocab.esea.education/A/C002";
    expect(parseSearchParams(url).conceptFilters).toEqual([
      [
        "https://vocab.esea.education/A/C001",
        "https://vocab.esea.education/A/C002",
      ],
    ]);
  });

  test("multiple concept= params → multiple groups (AND between)", () => {
    const url =
      "?concept=https://vocab.esea.education/A/C001" +
      "&concept=https://vocab.esea.education/B/C010,https://vocab.esea.education/B/C011";
    expect(parseSearchParams(url).conceptFilters).toEqual([
      ["https://vocab.esea.education/A/C001"],
      [
        "https://vocab.esea.education/B/C010",
        "https://vocab.esea.education/B/C011",
      ],
    ]);
  });

  test("trims whitespace inside comma-separated values", () => {
    const url = "?concept=https://x/A , https://x/B";
    expect(parseSearchParams(url).conceptFilters).toEqual([
      ["https://x/A", "https://x/B"],
    ]);
  });

  test("drops empty entries (trailing commas, empty params)", () => {
    const url = "?concept=https://x/A,,&concept=";
    expect(parseSearchParams(url).conceptFilters).toEqual([["https://x/A"]]);
  });
});

describe("parseSearchParams country codes", () => {
  test("single country= param → one code", () => {
    expect(parseSearchParams("?country=DE").countryCodes).toEqual(["DE"]);
  });

  test("comma-separated value → multiple codes (OR semantics)", () => {
    expect(parseSearchParams("?country=DE,FR").countryCodes).toEqual([
      "DE",
      "FR",
    ]);
  });

  test("multiple country= params flatten into one OR'd list (legacy/lenient)", () => {
    expect(parseSearchParams("?country=DE&country=FR").countryCodes).toEqual([
      "DE",
      "FR",
    ]);
  });

  test("upper-cases lower-case codes from hand-edited URLs", () => {
    expect(parseSearchParams("?country=de,fr").countryCodes).toEqual([
      "DE",
      "FR",
    ]);
  });

  test("rejects non-ISO-3166-alpha-2 values", () => {
    expect(parseSearchParams("?country=DEU,1,,DE").countryCodes).toEqual(["DE"]);
  });
});

describe("toQueryString", () => {
  test("omits defaults", () => {
    expect(toQueryString(makeSearchParams())).toBe("");
  });

  test("fixed key order: q, start_year, end_year, sort, page", () => {
    const p = makeSearchParams({ q: "phonics", page: 3, startYear: 2010, endYear: 2024, sort: "newest" });
    expect(toQueryString(p)).toBe("q=phonics&start_year=2010&end_year=2024&sort=newest&page=3");
  });

  test("page=1 (default) is dropped from output, q is kept", () => {
    expect(toQueryString(makeSearchParams({ q: "phonics" }))).toBe("q=phonics");
  });

  test("URL-encodes q", () => {
    expect(toQueryString(makeSearchParams({ q: "a b&c" }))).toBe("q=a+b%26c");
  });

  test("sort omitted when undefined (relevance default)", () => {
    expect(toQueryString(makeSearchParams({ q: "phonics" }))).toBe("q=phonics");
  });

  test.each([
    { sort: "newest" as const },
    { sort: "oldest" as const },
  ])("sort=$sort is emitted", ({ sort }) => {
    expect(toQueryString(makeSearchParams({ sort }))).toBe(`sort=${sort}`);
  });

  test("round-trip normalization (year + sort)", () => {
    const raw = "?page=abc&q=%20hello%20&start_year=2024&end_year=2010&sort=garbage";
    const canonical = toQueryString(parseSearchParams(raw));
    expect(canonical).toBe("q=hello");
  });

  test("emits one concept= param per group, comma-joining URIs within each group", () => {
    const p = makeSearchParams({
      conceptFilters: [["https://x/A"], ["https://y/B", "https://y/C"]],
    });
    expect(toQueryString(p)).toBe(
      "concept=https%3A%2F%2Fx%2FA&concept=https%3A%2F%2Fy%2FB%2Chttps%3A%2F%2Fy%2FC",
    );
  });

  test("emits a single comma-joined country= param (OR semantics)", () => {
    const p = makeSearchParams({ countryCodes: ["DE", "FR"] });
    expect(toQueryString(p)).toBe("country=DE%2CFR");
  });

  test("q comes before concept=, country=, and tail params", () => {
    const p = makeSearchParams({
      q: "phonics",
      page: 3,
      startYear: 2010,
      sort: "newest",
      conceptFilters: [["https://x/A"]],
      countryCodes: ["DE"],
    });
    const keyOrder = Array.from(new URLSearchParams(toQueryString(p)).keys());
    expect(keyOrder).toEqual(["q", "concept", "country", "start_year", "sort", "page"]);
  });

  test("round-trips structured concept filters through parse → serialise → parse", () => {
    const input = makeSearchParams({
      q: "phonics",
      conceptFilters: [
        ["https://vocab.esea.education/A/C001"],
        [
          "https://vocab.esea.education/B/C010",
          "https://vocab.esea.education/B/C011",
        ],
      ],
    });
    const serialised = toQueryString(input);
    const parsed = parseSearchParams("?" + serialised);
    expect(parsed).toEqual(input);
  });

  test("round-trips country codes through parse → serialise → parse", () => {
    const input = makeSearchParams({ q: "phonics", countryCodes: ["DE", "FR"] });
    const serialised = toQueryString(input);
    expect(parseSearchParams("?" + serialised)).toEqual(input);
  });
});

describe("buildSearchUrl", () => {
  test("empty params → bare slug path", () => {
    expect(buildSearchUrl("esea", makeSearchParams())).toBe("/esea");
  });

  test("with params → slug + querystring", () => {
    expect(buildSearchUrl("esea", makeSearchParams({ q: "phonics", page: 2 }))).toBe("/esea?q=phonics&page=2");
  });
});

describe("toUnpaginatedSearchQuery", () => {
  test("no concept or country, non-empty q → existing behaviour preserved", () => {
    const p = makeSearchParams({ q: "phonics" });
    expect(toUnpaginatedSearchQuery(p, ["dom-x"]).query).toBe("phonics");
  });

  test("no concept or country, empty q → '*' substitution", () => {
    expect(toUnpaginatedSearchQuery(makeSearchParams(), ["dom-x"]).query).toBe("*");
  });

  test("country filters travel as structured filter, not embedded in query", () => {
    const p = makeSearchParams({ q: "phonics", countryCodes: ["DE", "FR"] });
    const out = toUnpaginatedSearchQuery(p, ["dom-x"]);
    expect(out.query).toBe("phonics");
    expect(out.filters.countryCodes).toEqual(["DE", "FR"]);
  });

  test("country filters with empty q → '*' query, codes on filters", () => {
    const p = makeSearchParams({ countryCodes: ["DE"] });
    const out = toUnpaginatedSearchQuery(p, ["dom-x"]);
    expect(out.query).toBe("*");
    expect(out.filters.countryCodes).toEqual(["DE"]);
  });

  test("concept filters travel as structured filter, not embedded in query", () => {
    const p = makeSearchParams({
      q: "phonics",
      conceptFilters: [["https://x/A"]],
    });
    const out = toUnpaginatedSearchQuery(p, ["dom-x"]);
    expect(out.query).toBe("phonics");
    expect(out.filters.conceptFilters).toEqual([["https://x/A"]]);
  });

  test("filters carry years + annotations + sort alongside structured countries", () => {
    const p = makeSearchParams({
      q: "phonics",
      startYear: 2010,
      endYear: 2024,
      sort: "newest",
      countryCodes: ["DE"],
    });
    expect(toUnpaginatedSearchQuery(p, ["dom-x"]).filters).toEqual({
      startYear: 2010,
      endYear: 2024,
      annotation: ["dom-x"],
      sort: ["-publication_year"],
      countryCodes: ["DE"],
    });
  });
});
