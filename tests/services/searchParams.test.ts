import { describe, test, expect } from "vitest";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  valuesToFacet,
  facetToValues,
  type SearchParams,
} from "@/services/searchParams";

describe("parseSearchParams", () => {
  test("empty search → defaults", () => {
    expect(parseSearchParams("")).toEqual({
      q: "",
      page: 1,
      startYear: undefined,
      endYear: undefined,
      sort: undefined,
      searchFacets: [],
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
      searchFacets: [],
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

describe("toQueryString", () => {
  test("omits defaults", () => {
    const p: SearchParams = { q: "", page: 1, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(toQueryString(p)).toBe("");
  });

  test("fixed key order: q, start_year, end_year, sort, page", () => {
    const p: SearchParams = { q: "phonics", page: 3, startYear: 2010, endYear: 2024, sort: "newest", searchFacets: [] };
    expect(toQueryString(p)).toBe("q=phonics&start_year=2010&end_year=2024&sort=newest&page=3");
  });

  test("page=1 (default) is dropped from output, q is kept", () => {
    const p: SearchParams = { q: "phonics", page: 1, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(toQueryString(p)).toBe("q=phonics");
  });

  test("URL-encodes q", () => {
    const p: SearchParams = { q: "a b&c", page: 1, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(toQueryString(p)).toBe("q=a+b%26c");
  });

  test("sort omitted when undefined (relevance default)", () => {
    const p: SearchParams = { q: "phonics", page: 1, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(toQueryString(p)).toBe("q=phonics");
  });

  test.each([
    { sort: "newest" as const },
    { sort: "oldest" as const },
  ])("sort=$sort is emitted", ({ sort }) => {
    const p: SearchParams = { q: "", page: 1, startYear: undefined, endYear: undefined, sort, searchFacets: [] };
    expect(toQueryString(p)).toBe(`sort=${sort}`);
  });

  test("round-trip normalization", () => {
    const raw = "?page=abc&q=%20hello%20&start_year=2024&end_year=2010&sort=garbage";
    const canonical = toQueryString(parseSearchParams(raw));
    expect(canonical).toBe("q=hello");
  });
});

describe("searchFacets", () => {
  test("parse: URL with trailing single facet splits q and facet", () => {
    const raw = `?q=cancer AND (linked_data_concepts:"http://A")`;
    const p = parseSearchParams(raw);
    expect(p.q).toBe("cancer");
    expect(p.searchFacets).toEqual([`linked_data_concepts:"http://A"`]);
  });

  test("parse: multiple trailing facets preserve original left-to-right order", () => {
    const raw = `?q=cancer AND (linked_data_concepts:"A") AND (linked_data_concepts:"B")`;
    const p = parseSearchParams(raw);
    expect(p.q).toBe("cancer");
    expect(p.searchFacets).toEqual([
      `linked_data_concepts:"A"`,
      `linked_data_concepts:"B"`,
    ]);
  });

  test("parse: facet may itself contain OR", () => {
    const raw = `?q=cancer AND (linked_data_concepts:"A" OR linked_data_concepts:"B")`;
    const p = parseSearchParams(raw);
    expect(p.q).toBe("cancer");
    expect(p.searchFacets).toEqual([
      `linked_data_concepts:"A" OR linked_data_concepts:"B"`,
    ]);
  });

  test("parse: `* AND (facet)` collapses back to empty q + facet (canonical * shim)", () => {
    const raw = `?q=* AND (linked_data_concepts:"A")`;
    const p = parseSearchParams(raw);
    expect(p.q).toBe("");
    expect(p.searchFacets).toEqual([`linked_data_concepts:"A"`]);
  });

  test("parse: user-typed trailing parens that aren't a facet are left in q", () => {
    const raw = `?q=cancer AND (something_else:"X")`;
    const p = parseSearchParams(raw);
    expect(p.q).toBe(`cancer AND (something_else:"X")`);
    expect(p.searchFacets).toEqual([]);
  });

  test("serialize: empty q + single facet emits `q=* AND (facet)`", () => {
    const p: SearchParams = {
      q: "",
      page: 1,
      startYear: undefined,
      endYear: undefined,
      sort: undefined,
      searchFacets: [`linked_data_concepts:"http://A"`],
    };
    const qs = toQueryString(p);
    const got = new URLSearchParams(qs).get("q");
    expect(got).toBe(`* AND (linked_data_concepts:"http://A")`);
  });

  test("serialize: non-empty q + multiple facets ANDs each wrapped in parens", () => {
    const p: SearchParams = {
      q: "cancer",
      page: 1,
      startYear: undefined,
      endYear: undefined,
      sort: undefined,
      searchFacets: [`linked_data_concepts:"A"`, `linked_data_concepts:"B"`],
    };
    const got = new URLSearchParams(toQueryString(p)).get("q");
    expect(got).toBe(`cancer AND (linked_data_concepts:"A") AND (linked_data_concepts:"B")`);
  });

  test("round-trip: parse → serialize → parse preserves q and facets", () => {
    const raw = `?q=cancer AND (linked_data_concepts:"A") AND (linked_data_concepts:"B")`;
    const once = parseSearchParams(raw);
    const twice = parseSearchParams("?" + toQueryString(once));
    expect(twice).toEqual(once);
  });

  test("empty searchFacets array is omitted from URL output", () => {
    const p: SearchParams = {
      q: "",
      page: 1,
      startYear: undefined,
      endYear: undefined,
      sort: undefined,
      searchFacets: [],
    };
    expect(toQueryString(p)).toBe("");
  });
});

describe("valuesToFacet / facetToValues", () => {
  test("valuesToFacet: single value → one linked_data_concepts clause", () => {
    expect(valuesToFacet(["http://A"])).toBe(`linked_data_concepts:"http://A"`);
  });

  test("valuesToFacet: multiple values are wrapped and ORed", () => {
    expect(valuesToFacet(["http://A", "http://B"])).toBe(
      `linked_data_concepts:"http://A" OR linked_data_concepts:"http://B"`,
    );
  });

  test("valuesToFacet: trims and drops empty entries", () => {
    expect(valuesToFacet(["  http://A  ", "", "http://B"])).toBe(
      `linked_data_concepts:"http://A" OR linked_data_concepts:"http://B"`,
    );
    expect(valuesToFacet([])).toBe("");
    expect(valuesToFacet(["", "   "])).toBe("");
  });

  test("facetToValues: extracts values from a Lucene fragment", () => {
    expect(
      facetToValues(
        `linked_data_concepts:"http://A" OR linked_data_concepts:"http://B"`,
      ),
    ).toEqual(["http://A", "http://B"]);
  });

  test("facetToValues: returns [] for an unrecognized fragment", () => {
    expect(facetToValues(`some_other_field:"X"`)).toEqual([]);
  });

  test("round-trip: values → fragment → values is stable", () => {
    const values = ["http://A", "http://B"];
    expect(facetToValues(valuesToFacet(values))).toEqual(values);
  });
});

describe("buildSearchUrl", () => {
  test("empty params → bare slug path", () => {
    const p: SearchParams = { q: "", page: 1, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(buildSearchUrl("esea", p)).toBe("/esea");
  });

  test("with params → slug + querystring", () => {
    const p: SearchParams = { q: "phonics", page: 2, startYear: undefined, endYear: undefined, sort: undefined, searchFacets: [] };
    expect(buildSearchUrl("esea", p)).toBe("/esea?q=phonics&page=2");
  });
});
