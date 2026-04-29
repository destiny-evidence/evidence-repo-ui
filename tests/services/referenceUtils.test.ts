import { describe, test, expect } from "vitest";
import {
  extractBibliographic,
  extractLinkedData,
  extractDoi,
  formatPagination,
} from "@/services/referenceUtils";
import type {
  Reference,
  Enhancement,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
} from "@/types/models";

function makeEnhancement(
  content: Enhancement["content"],
  createdAt: string | null = null,
): Enhancement {
  return {
    id: null,
    reference_id: "ref-1",
    source: "test",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: createdAt,
    content,
  };
}

function makeRef(enhancements: Enhancement[] | null): Reference {
  return {
    id: "ref-1",
    visibility: "public",
    identifiers: null,
    enhancements,
  };
}

describe("extractBibliographic", () => {
  test("returns null when enhancements is null", () => {
    expect(extractBibliographic(makeRef(null))).toBeNull();
  });

  test("returns null when no bibliographic enhancement exists", () => {
    const ref = makeRef([
      makeEnhancement({
        enhancement_type: "abstract",
        process: "x",
        abstract: "y",
      }),
    ]);
    expect(extractBibliographic(ref)).toBeNull();
  });

  test("returns bibliographic content when present", () => {
    const bib: BibliographicMetadataEnhancement = {
      enhancement_type: "bibliographic",
      authorship: null,
      cited_by_count: 5,
      created_date: null,
      updated_date: null,
      publication_date: null,
      publication_year: 2024,
      publisher: null,
      title: "Test",
      pagination: null,
      publication_venue: null,
    };
    const ref = makeRef([makeEnhancement(bib)]);
    expect(extractBibliographic(ref)).toBe(bib);
  });

  test("returns the most recent bibliographic enhancement by created_at", () => {
    const older: BibliographicMetadataEnhancement = {
      enhancement_type: "bibliographic",
      authorship: null,
      cited_by_count: null,
      created_date: null,
      updated_date: null,
      publication_date: null,
      publication_year: 2020,
      publisher: null,
      title: "Older",
      pagination: null,
      publication_venue: null,
    };
    const newer: BibliographicMetadataEnhancement = {
      enhancement_type: "bibliographic",
      authorship: null,
      cited_by_count: null,
      created_date: null,
      updated_date: null,
      publication_date: null,
      publication_year: 2024,
      publisher: null,
      title: "Newer",
      pagination: null,
      publication_venue: null,
    };
    const ref = makeRef([
      makeEnhancement(newer, "2026-01-01T00:00:00Z"),
      makeEnhancement(older, "2025-01-01T00:00:00Z"),
    ]);
    expect(extractBibliographic(ref)).toBe(newer);
  });
});

describe("extractLinkedData", () => {
  test("returns null when enhancements is null", () => {
    expect(extractLinkedData(makeRef(null))).toBeNull();
  });

  test("returns null when no linked_data enhancement exists", () => {
    const ref = makeRef([
      makeEnhancement({
        enhancement_type: "abstract",
        process: "x",
        abstract: "y",
      }),
    ]);
    expect(extractLinkedData(ref)).toBeNull();
  });

  test("returns linked_data content when present", () => {
    const ld: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://example.com",
      data: { key: "value" },
    };
    const ref = makeRef([makeEnhancement(ld)]);
    expect(extractLinkedData(ref)).toBe(ld);
  });

  test("returns the most recent linked_data enhancement by created_at", () => {
    const older: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://older.com",
      data: { n: 1 },
    };
    const newer: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://newer.com",
      data: { n: 2 },
    };
    const ref = makeRef([
      makeEnhancement(newer, "2026-02-01T00:00:00Z"),
      makeEnhancement(older, "2025-01-01T00:00:00Z"),
    ]);
    expect(extractLinkedData(ref)).toBe(newer);
  });
});

describe("extractDoi", () => {
  test("returns null when identifiers is null", () => {
    expect(extractDoi(null)).toBeNull();
  });

  test("returns null when no DOI identifier exists", () => {
    expect(
      extractDoi([{ identifier: 123, identifier_type: "pm_id" }]),
    ).toBeNull();
  });

  test("returns DOI string when present", () => {
    expect(
      extractDoi([
        { identifier: "10.1234/test", identifier_type: "doi" },
      ]),
    ).toBe("10.1234/test");
  });

  test("returns null for non-string DOI identifier", () => {
    expect(
      extractDoi([{ identifier: 12345, identifier_type: "doi" }]),
    ).toBeNull();
  });
});

describe("formatPagination", () => {
  test("returns empty string when pagination is null", () => {
    expect(formatPagination(null)).toBe("");
  });

  test("returns empty string when all fields are null", () => {
    expect(formatPagination({
      volume: null, issue: null, first_page: null, last_page: null,
    })).toBe("");
  });

  test("formats volume + issue + page range as '45(2), 112–130' with en dash", () => {
    expect(formatPagination({
      volume: "45", issue: "2", first_page: "112", last_page: "130",
    })).toBe("45(2), 112–130");
  });

  test("formats volume + issue alone (no pages) as '45(2)'", () => {
    expect(formatPagination({
      volume: "45", issue: "2", first_page: null, last_page: null,
    })).toBe("45(2)");
  });

  test("formats volume alone as '45'", () => {
    expect(formatPagination({
      volume: "45", issue: null, first_page: null, last_page: null,
    })).toBe("45");
  });

  test("formats volume + page range without issue as '45, 112–130'", () => {
    expect(formatPagination({
      volume: "45", issue: null, first_page: "112", last_page: "130",
    })).toBe("45, 112–130");
  });

  test("formats issue alone as '(2)'", () => {
    expect(formatPagination({
      volume: null, issue: "2", first_page: null, last_page: null,
    })).toBe("(2)");
  });

  test("formats single-page article (first_page only) as '112'", () => {
    expect(formatPagination({
      volume: null, issue: null, first_page: "112", last_page: null,
    })).toBe("112");
  });

  test("collapses identical first/last to single page (no en dash)", () => {
    expect(formatPagination({
      volume: null, issue: null, first_page: "112", last_page: "112",
    })).toBe("112");
  });

  test("falls back to last_page when first_page missing", () => {
    expect(formatPagination({
      volume: null, issue: null, first_page: null, last_page: "130",
    })).toBe("130");
  });
});
