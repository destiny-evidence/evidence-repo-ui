import { describe, test, expect } from "vitest";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  buildFacetedQuery,
  toExportSearchQuery,
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

describe("parseSearchParams facet peel + unwrap", () => {
  test.each([
    {
      label: "peels single trailing facet",
      raw: '?q=phonics AND (linked_data_concepts:"EducationLevelScheme/C00002")',
      q: "phonics",
      facets: ['linked_data_concepts:"EducationLevelScheme/C00002"'],
    },
    {
      label: "peels multiple trailing facets in order",
      raw: '?q=phonics AND (linked_data_concepts:"x") AND (linked_data_concepts:"y")',
      q: "phonics",
      facets: ['linked_data_concepts:"x"', 'linked_data_concepts:"y"'],
    },
    {
      label: "peels facet with internal OR",
      raw: '?q=phonics AND (linked_data_concepts:"x" OR linked_data_concepts:"y")',
      q: "phonics",
      facets: ['linked_data_concepts:"x" OR linked_data_concepts:"y"'],
    },
    {
      label: "non-facet trailing AND clause stays in q (no silent drop)",
      raw: '?q=phonics AND (something_else:"x")',
      q: 'phonics AND (something_else:"x")',
      facets: [],
    },
    {
      label: "non-trailing facet-shaped text stays in q",
      raw: '?q=foo AND (linked_data_concepts:"x") bar',
      q: 'foo AND (linked_data_concepts:"x") bar',
      facets: [],
    },
    {
      label: "unwraps lone-paren base after peel",
      raw: '?q=(phonics) AND (linked_data_concepts:"x")',
      q: "phonics",
      facets: ['linked_data_concepts:"x"'],
    },
    {
      label: "unwraps multi-token paren-wrapped base after peel",
      raw: '?q=(phonics OR reading) AND (linked_data_concepts:"x")',
      q: "phonics OR reading",
      facets: ['linked_data_concepts:"x"'],
    },
    // Nested-paren base must still unwrap, or parse→serialise adds a layer each cycle.
    {
      label: "unwraps nested-paren base (balanced walker)",
      raw: '?q=(phonics OR (reading)) AND (linked_data_concepts:"x")',
      q: "phonics OR (reading)",
      facets: ['linked_data_concepts:"x"'],
    },
    {
      label: "unwraps base with field-scoped subquery",
      raw: '?q=(title:(phonics OR reading)) AND (linked_data_concepts:"x")',
      q: "title:(phonics OR reading)",
      facets: ['linked_data_concepts:"x"'],
    },
    // Outer pair isn't balanced — first "(" closes mid-string. Leave untouched.
    {
      label: "does NOT unwrap when outer parens are not a balanced pair",
      raw: '?q=(a) AND (b) AND (linked_data_concepts:"x")',
      q: "(a) AND (b)",
      facets: ['linked_data_concepts:"x"'],
    },
    {
      label: "strips lone * sentinel after peel",
      raw: '?q=* AND (linked_data_concepts:"x")',
      q: "",
      facets: ['linked_data_concepts:"x"'],
    },
    {
      label: "literal * with no facets is preserved",
      raw: "?q=*",
      q: "*",
      facets: [],
    },
  ])("$label", ({ raw, q, facets }) => {
    const p = parseSearchParams(raw);
    expect(p.q).toBe(q);
    expect(p.searchFacets).toEqual(facets);
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

  test("round-trip normalization", () => {
    const raw = "?page=abc&q=%20hello%20&start_year=2024&end_year=2010&sort=garbage";
    const canonical = toQueryString(parseSearchParams(raw));
    expect(canonical).toBe("q=hello");
  });

  test("empty q + one facet → decoded q is '* AND (facet)'", () => {
    const p = makeSearchParams({ searchFacets: ['linked_data_concepts:"x"'] });
    const q = new URLSearchParams(toQueryString(p)).get("q");
    expect(q).toBe('* AND (linked_data_concepts:"x")');
  });

  test("non-empty q + facets → '(base) AND (f1) AND (f2)'", () => {
    const p = makeSearchParams({
      q: "phonics",
      searchFacets: ['linked_data_concepts:"x"', 'linked_data_concepts:"y"'],
    });
    const q = new URLSearchParams(toQueryString(p)).get("q");
    expect(q).toBe('(phonics) AND (linked_data_concepts:"x") AND (linked_data_concepts:"y")');
  });

  test("compact-form facet URL round-trips through parse → serialise → parse", () => {
    const url = '?q=(phonics OR reading) AND (linked_data_concepts:"EducationLevelScheme/C00002") AND (linked_data_concepts:"OutcomeScheme/C00123")&page=2';
    const first = parseSearchParams(url);
    const serialised = toQueryString(first);
    const second = parseSearchParams("?" + serialised);
    expect(second).toEqual(first);
  });

  test("round-trip from typed state with empty q + facets", () => {
    const input = makeSearchParams({
      searchFacets: ['linked_data_concepts:"x"'],
    });
    const serialised = toQueryString(input);
    const parsed = parseSearchParams("?" + serialised);
    expect(parsed).toEqual(input);
  });

  // Locks the contract a multi-select ConceptSchemeFilter relies on: one
  // facet entry containing an internal OR must survive parse → serialise →
  // parse without being split into two separate facets or losing the OR.
  test("round-trip from typed state with an OR-joined facet preserves the facet verbatim", () => {
    const input = makeSearchParams({
      q: "phonics",
      searchFacets: [
        'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"' +
          ' OR linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00003"',
      ],
    });
    const serialised = toQueryString(input);
    const parsed = parseSearchParams("?" + serialised);
    expect(parsed).toEqual(input);
  });

  test("q stays first when facets are combined with start_year/sort/page", () => {
    const p = makeSearchParams({
      q: "phonics",
      page: 3,
      startYear: 2010,
      sort: "newest",
      searchFacets: ['linked_data_concepts:"x"'],
    });
    const keyOrder = Array.from(new URLSearchParams(toQueryString(p)).keys());
    expect(keyOrder).toEqual(["q", "start_year", "sort", "page"]);
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

describe("buildFacetedQuery", () => {
  test.each([
    {
      label: "no facets, whitespace q → empty (trim + collapse)",
      q: "   ", facets: [],
      expected: "",
    },
    {
      label: "empty q + one facet → * AND (facet)",
      q: "", facets: ['linked_data_concepts:"x"'],
      expected: '* AND (linked_data_concepts:"x")',
    },
    {
      label: "empty q + multiple facets",
      q: "", facets: ['linked_data_concepts:"x"', 'linked_data_concepts:"y"'],
      expected: '* AND (linked_data_concepts:"x") AND (linked_data_concepts:"y")',
    },
    {
      label: "non-empty q wraps base",
      q: "phonics", facets: ['linked_data_concepts:"x"'],
      expected: '(phonics) AND (linked_data_concepts:"x")',
    },
    // Without the wrap, `phonics OR reading AND (f)` binds as
    // `phonics OR (reading AND (f))` — wrong semantics.
    {
      label: "boolean base is wrapped (precedence)",
      q: "phonics OR reading", facets: ['linked_data_concepts:"x"'],
      expected: '(phonics OR reading) AND (linked_data_concepts:"x")',
    },
    {
      label: "facet with OR clause passes through verbatim",
      q: "phonics", facets: ['linked_data_concepts:"x" OR linked_data_concepts:"y"'],
      expected: '(phonics) AND (linked_data_concepts:"x" OR linked_data_concepts:"y")',
    },
  ])("$label", ({ q, facets, expected }) => {
    expect(buildFacetedQuery(q, facets)).toBe(expected);
  });
});

describe("toExportSearchQuery with facets", () => {
  const FACET = 'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"';

  test("no facets, non-empty q → existing behaviour preserved", () => {
    const p = makeSearchParams({ q: "phonics" });
    expect(toExportSearchQuery(p, ["dom-x"]).query).toBe("phonics");
  });

  test("no facets, empty q → '*' substitution preserved", () => {
    expect(toExportSearchQuery(makeSearchParams(), ["dom-x"]).query).toBe("*");
  });

  test("facets present, non-empty q → '(base) AND (facet)'", () => {
    const p = makeSearchParams({ q: "phonics", searchFacets: [FACET] });
    expect(toExportSearchQuery(p, ["dom-x"]).query).toBe(`(phonics) AND (${FACET})`);
  });

  test("facets present, empty q → '* AND (facet)'", () => {
    const p = makeSearchParams({ searchFacets: [FACET] });
    expect(toExportSearchQuery(p, ["dom-x"]).query).toBe(`* AND (${FACET})`);
  });

  test("filters (annotation, years, sort) unaffected by facets", () => {
    const p = makeSearchParams({
      q: "phonics",
      startYear: 2010,
      endYear: 2024,
      sort: "newest",
      searchFacets: [FACET],
    });
    expect(toExportSearchQuery(p, ["dom-x"]).filters).toEqual({
      startYear: 2010,
      endYear: 2024,
      annotation: ["dom-x"],
      sort: ["-publication_year"],
    });
  });
});
