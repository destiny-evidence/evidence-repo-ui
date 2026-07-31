import { describe, expect, test } from "vitest";
import { addedFilterKeys, hasActiveSearch } from "@/analytics/searchEvents";
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

describe("addedFilterKeys", () => {
  test("surfaces newly-set country and year-range, but not the unchanged scheme", () => {
    const previous: AppliedFilters = { ...EMPTY, conceptFilters: [[URI_JOURNAL]] };
    const next: AppliedFilters = {
      conceptFilters: [[URI_JOURNAL]],
      countryCodes: ["KE"],
      startYear: 2000,
      endYear: undefined,
    };
    expect(new Set(addedFilterKeys(previous, next, [SCHEME_A, SCHEME_B]))).toEqual(
      new Set(["country", "year-range"]),
    );
  });

  test("a second concept within an already-active scheme is a new filter", () => {
    const previous: AppliedFilters = { ...EMPTY, conceptFilters: [[URI_JOURNAL]] };
    const next: AppliedFilters = { ...EMPTY, conceptFilters: [[URI_JOURNAL, URI_THESIS]] };
    expect(addedFilterKeys(previous, next, [SCHEME_A])).toEqual([SCHEME_A.uri]);
  });

  test("a second country is a new filter", () => {
    const previous: AppliedFilters = { ...EMPTY, countryCodes: ["KE"] };
    const next: AppliedFilters = { ...EMPTY, countryCodes: ["KE", "UG"] };
    expect(addedFilterKeys(previous, next, [SCHEME_A])).toEqual(["country"]);
  });

  test("a newly-filtered scheme surfaces its key", () => {
    const previous: AppliedFilters = { ...EMPTY, conceptFilters: [[URI_JOURNAL]] };
    const next: AppliedFilters = {
      ...EMPTY,
      conceptFilters: [[URI_JOURNAL], [URI_STUDY]],
    };
    expect(addedFilterKeys(previous, next, [SCHEME_A, SCHEME_B])).toEqual([
      SCHEME_B.uri,
    ]);
  });

  test("a changed year range counts, an unchanged one does not", () => {
    const set: AppliedFilters = { ...EMPTY, startYear: 2000, endYear: 2010 };
    expect(addedFilterKeys(set, set, [SCHEME_A])).toEqual([]);
    expect(
      addedFilterKeys(set, { ...set, endYear: 2020 }, [SCHEME_A]),
    ).toEqual(["year-range"]);
  });

  test("no change yields no keys", () => {
    const same: AppliedFilters = { ...EMPTY, countryCodes: ["KE"] };
    expect(addedFilterKeys(same, same, [SCHEME_A])).toEqual([]);
  });

  test("concept URIs outside any supplied scheme are ignored", () => {
    expect(
      addedFilterKeys(EMPTY, { ...EMPTY, conceptFilters: [["https://unknown/x"]] }, [
        SCHEME_A,
      ]),
    ).toEqual([]);
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
