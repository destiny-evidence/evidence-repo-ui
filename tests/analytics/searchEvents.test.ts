import { describe, expect, test } from "vitest";
import { activeFilterKeys } from "@/analytics/searchEvents";
import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

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

describe("activeFilterKeys", () => {
  test("returns nothing when no filters are active", () => {
    expect(activeFilterKeys(EMPTY, [SCHEME_A, SCHEME_B])).toEqual([]);
  });

  test("one key per active concept scheme, plus country and year-range", () => {
    const keys = activeFilterKeys(
      {
        conceptFilters: [[URI_JOURNAL, URI_THESIS], [URI_STUDY]],
        countryCodes: ["KE"],
        startYear: 2000,
        endYear: undefined,
      },
      [SCHEME_A, SCHEME_B],
    );
    expect(new Set(keys)).toEqual(
      new Set([SCHEME_A.uri, SCHEME_B.uri, "country", "year-range"]),
    );
  });

  test("a one-sided year range still counts as year-range", () => {
    expect(
      activeFilterKeys({ ...EMPTY, endYear: 2020 }, [SCHEME_A]),
    ).toEqual(["year-range"]);
  });

  test("concept URIs outside any supplied scheme are dropped", () => {
    expect(
      activeFilterKeys({ ...EMPTY, conceptFilters: [["https://unknown/x"]] }, [
        SCHEME_A,
      ]),
    ).toEqual([]);
  });
});
