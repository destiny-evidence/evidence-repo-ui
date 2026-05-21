import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";
import { findCommunity } from "@/services/communities";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  buildFacetedQuery,
  expandFacets,
  compactFacets,
  type SearchParams,
} from "@/services/searchParams";

const CONTEXT_FIXTURE_PATH = resolve(
  __dirname,
  "../services/export/fixtures/context.jsonld",
);

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

describe("buildFacetedQuery", () => {
  test.each([
    {
      label: "no facets trims q",
      q: "  phonics  ", facets: [],
      expected: "phonics",
    },
    {
      label: "no facets, empty q → empty",
      q: "", facets: [],
      expected: "",
    },
    {
      label: "no facets, whitespace q → empty",
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

describe("expandFacets / compactFacets (inverse boundary transforms)", () => {
  const base = findCommunity("esea")!.vocabBase;

  test("esea Community.vocabBase agrees with the JSON-LD context fixture's `esea` prefix", () => {
    const ctx = JSON.parse(readFileSync(CONTEXT_FIXTURE_PATH, "utf-8")) as {
      "@context": Record<string, string>;
    };
    expect(ctx["@context"].esea).toBe(base);
  });

  test.each([
    {
      label: "expand: empty array",
      input: [],
      expanded: [],
    },
    {
      label: "expand: single compact URI",
      input: ['linked_data_concepts:"EducationLevelScheme/C00002"'],
      expanded: ['linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"'],
    },
    {
      label: "expand: OR-joined URIs in one facet",
      input: [
        'linked_data_concepts:"EducationLevelScheme/C00002" OR linked_data_concepts:"EducationLevelScheme/C00003"',
      ],
      expanded: [
        'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002" OR linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00003"',
      ],
    },
    {
      label: "expand: multiple facets expand independently",
      input: [
        'linked_data_concepts:"EducationLevelScheme/C00002"',
        'linked_data_concepts:"OutcomeScheme/C00123"',
      ],
      expanded: [
        'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"',
        'linked_data_concepts:"https://vocab.esea.education/OutcomeScheme/C00123"',
      ],
    },
  ])("$label", ({ input, expanded }) => {
    expect(expandFacets(input, base)).toEqual(expanded);
  });

  test.each([
    {
      label: "compact: single full URI",
      input: ['linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"'],
      compact: ['linked_data_concepts:"EducationLevelScheme/C00002"'],
    },
    {
      label: "compact: OR-joined full URIs",
      input: [
        'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002" OR linked_data_concepts:"https://vocab.esea.education/OutcomeScheme/C00123"',
      ],
      compact: [
        'linked_data_concepts:"EducationLevelScheme/C00002" OR linked_data_concepts:"OutcomeScheme/C00123"',
      ],
    },
    {
      label: "compact: already-compact passes through",
      input: ['linked_data_concepts:"EducationLevelScheme/C00002"'],
      compact: ['linked_data_concepts:"EducationLevelScheme/C00002"'],
    },
    {
      label: "compact: URI from foreign vocab is left alone",
      input: ['linked_data_concepts:"https://other.example.org/Foo/Bar"'],
      compact: ['linked_data_concepts:"https://other.example.org/Foo/Bar"'],
    },
  ])("$label", ({ input, compact }) => {
    expect(compactFacets(input, base)).toEqual(compact);
  });

  test("expand is defensive: already-expanded URI passes through", () => {
    expect(expandFacets(
      ['linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"'],
      base,
    )).toEqual([
      'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002"',
    ]);
  });

  test("mixed compact + expanded in one facet → expand normalises all", () => {
    expect(expandFacets([
      'linked_data_concepts:"EducationLevelScheme/C00002" OR linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00003"',
    ], base)).toEqual([
      'linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00002" OR linked_data_concepts:"https://vocab.esea.education/EducationLevelScheme/C00003"',
    ]);
  });

  test("round-trip: compact(expand(x)) = x", () => {
    const compact = ['linked_data_concepts:"EducationLevelScheme/C00002"'];
    expect(compactFacets(expandFacets(compact, base), base)).toEqual(compact);
  });
});
