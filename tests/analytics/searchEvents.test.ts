import { describe, expect, test } from "vitest";
import { activeFilters, hasActiveSearch } from "@/analytics/searchEvents";
import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { makeSearchParams } from "../fixtures";

const URI_JOURNAL = "https://vocab.esea.education/DocumentTypeScheme/C00008";
const URI_THESIS = "https://vocab.esea.education/DocumentTypeScheme/C00012";
const SCHEME_A: ConceptScheme = {
  uri: "https://vocab.esea.education/DocumentTypeScheme",
  label: "Document type",
  topConcepts: [
    { uri: URI_JOURNAL, label: "Journal Article" },
    { uri: URI_THESIS, label: "Thesis" },
  ],
};
const URI_STUDY = "https://vocab.esea.education/StudyDesignScheme/C1";
const SCHEME_B: ConceptScheme = {
  uri: "https://vocab.esea.education/StudyDesignScheme",
  label: "Study design",
  topConcepts: [{ uri: URI_STUDY, label: "RCT" }],
};

const EMPTY: AppliedFilters = {
  conceptFilters: [],
  countryCodes: [],
  startYear: undefined,
  endYear: undefined,
};

describe("activeFilters", () => {
  test("returns nothing when no filters are active", () => {
    expect(activeFilters(EMPTY, [SCHEME_A, SCHEME_B])).toEqual({
      values: [],
      categories: [],
    });
  });

  test("values are the specific selections, categories the facets they belong to", () => {
    const { values, categories } = activeFilters(
      {
        conceptFilters: [[URI_JOURNAL, URI_THESIS], [URI_STUDY]],
        countryCodes: ["KE", "UG"],
        startYear: 2000,
        endYear: undefined,
      },
      [SCHEME_A, SCHEME_B],
    );
    expect(new Set(values)).toEqual(
      new Set([URI_JOURNAL, URI_THESIS, URI_STUDY, "KE", "UG", "2000-"]),
    );
    expect(new Set(categories)).toEqual(
      new Set([SCHEME_A.uri, SCHEME_B.uri, "country", "year-range"]),
    );
  });

  test("multiple concepts in a scheme are many values but one category", () => {
    const { values, categories } = activeFilters(
      { ...EMPTY, conceptFilters: [[URI_JOURNAL, URI_THESIS]] },
      [SCHEME_A],
    );
    expect(new Set(values)).toEqual(new Set([URI_JOURNAL, URI_THESIS]));
    expect(categories).toEqual([SCHEME_A.uri]);
  });

  test("a one-sided year range: value carries the open range, category stays generic", () => {
    expect(activeFilters({ ...EMPTY, endYear: 2020 }, [SCHEME_A])).toEqual({
      values: ["-2020"],
      categories: ["year-range"],
    });
  });

  test("concept URIs outside any supplied scheme are ignored", () => {
    expect(
      activeFilters({ ...EMPTY, conceptFilters: [["https://unknown/x"]] }, [SCHEME_A]),
    ).toEqual({ values: [], categories: [] });
  });
});

describe("hasActiveSearch", () => {
  test("false for a plain browse (no query, no filters)", () => {
    expect(hasActiveSearch(makeSearchParams({}))).toBe(false);
  });

  test("true when a query is present", () => {
    expect(hasActiveSearch(makeSearchParams({ q: "phonics" }))).toBe(true);
  });

  test("true for a filter-only browse", () => {
    expect(hasActiveSearch(makeSearchParams({ countryCodes: ["DE"] }))).toBe(true);
    expect(hasActiveSearch(makeSearchParams({ conceptFilters: [["x"]] }))).toBe(true);
    expect(hasActiveSearch(makeSearchParams({ startYear: 2000 }))).toBe(true);
    expect(hasActiveSearch(makeSearchParams({ endYear: 2020 }))).toBe(true);
  });
});
