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

// Three levels deep, so a path can't accidentally pass by carrying only the
// immediate parent.
const URI_LEARNING = "https://vocab.esea.education/OutcomeScheme/C1";
const URI_LITERACY = "https://vocab.esea.education/OutcomeScheme/C2";
const URI_PHONICS = "https://vocab.esea.education/OutcomeScheme/C3";
const NESTED_SCHEME: ConceptScheme = {
  uri: "https://vocab.esea.education/OutcomeScheme",
  label: "Outcome Scheme",
  topConcepts: [
    {
      uri: URI_LEARNING,
      label: "Learning",
      narrower: [
        {
          uri: URI_LITERACY,
          label: "Literacy",
          narrower: [{ uri: URI_PHONICS, label: "Phonics" }],
        },
      ],
    },
  ],
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
      new Set(["Journal Article", "Thesis", "RCT", "Kenya", "Uganda", "2000-"]),
    );
    expect(new Set(categories)).toEqual(
      new Set(["Document type", "Study design", "Country", "Year range"]),
    );
  });

  test("a nested concept carries its whole branch, root first", () => {
    const { values, categories } = activeFilters(
      { ...EMPTY, conceptFilters: [[URI_PHONICS]] },
      [NESTED_SCHEME],
    );
    expect(values).toEqual(["Learning > Literacy > Phonics"]);
    // "Scheme" is implementation detail of SKOS, dropped for the reader.
    expect(categories).toEqual(["Outcome"]);
  });

  test("a top concept is its own path, with no separator", () => {
    expect(
      activeFilters({ ...EMPTY, conceptFilters: [[URI_LEARNING]] }, [
        NESTED_SCHEME,
      ]).values,
    ).toEqual(["Learning"]);
  });

  test("selecting a parent does not enumerate its children", () => {
    expect(
      activeFilters({ ...EMPTY, conceptFilters: [[URI_LITERACY]] }, [
        NESTED_SCHEME,
      ]).values,
    ).toEqual(["Learning > Literacy"]);
  });

  test("multiple concepts in a scheme are many values but one category", () => {
    const { values, categories } = activeFilters(
      { ...EMPTY, conceptFilters: [[URI_JOURNAL, URI_THESIS]] },
      [SCHEME_A],
    );
    expect(new Set(values)).toEqual(new Set(["Journal Article", "Thesis"]));
    expect(categories).toEqual(["Document type"]);
  });

  test("a one-sided year range: value carries the open range, category stays generic", () => {
    expect(activeFilters({ ...EMPTY, endYear: 2020 }, [SCHEME_A])).toEqual({
      values: ["-2020"],
      categories: ["Year range"],
    });
  });

  test("concept URIs outside any supplied scheme are ignored", () => {
    expect(
      activeFilters({ ...EMPTY, conceptFilters: [["https://unknown/x"]] }, [
        SCHEME_A,
      ]),
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
    expect(hasActiveSearch(makeSearchParams({ countryCodes: ["DE"] }))).toBe(
      true,
    );
    expect(hasActiveSearch(makeSearchParams({ conceptFilters: [["x"]] }))).toBe(
      true,
    );
    expect(hasActiveSearch(makeSearchParams({ startYear: 2000 }))).toBe(true);
    expect(hasActiveSearch(makeSearchParams({ endYear: 2020 }))).toBe(true);
  });
});
