import { vi } from "vitest";
import { api } from "@/api/client";
import {
  searchReferences,
  getReference,
  extractBibliographic,
  extractLinkedData,
} from "@/services/apiClient";
import type {
  Reference,
  SearchResult,
  Enhancement,
  BibliographicMetadataEnhancement,
  LinkedDataEnhancement,
} from "@/types/models";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

beforeEach(() => {
  mockedGet.mockReset();
});

describe("searchReferences", () => {
  const result: SearchResult = {
    total: { count: 1, is_lower_bound: false },
    page: { count: 10, number: 1 },
    references: [],
  };

  test("calls the correct endpoint with query", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("climate change");
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=climate+change",
    );
  });

  test("appends page filter", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 3 });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test&page=3",
    );
  });

  test("appends page=0 when explicitly set", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { page: 0 });
    expect(mockedGet).toHaveBeenCalledWith(
      "/v1/references/search/?q=test&page=0",
    );
  });

  test("appends multiple annotation params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { annotation: ["foo", "bar"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("annotation")).toEqual(["foo", "bar"]);
  });

  test("appends multiple sort params", async () => {
    mockedGet.mockResolvedValue(result);
    await searchReferences("test", { sort: ["date", "-relevance"] });
    const url = mockedGet.mock.calls[0][0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("sort")).toEqual(["date", "-relevance"]);
  });

  test("returns the result from api.get", async () => {
    mockedGet.mockResolvedValue(result);
    const res = await searchReferences("test");
    expect(res).toBe(result);
  });
});

describe("getReference", () => {
  test("calls the correct endpoint", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue(ref);
    await getReference("abc-123");
    expect(mockedGet).toHaveBeenCalledWith("/v1/references/abc-123/");
  });

  test("returns the result", async () => {
    const ref = { id: "abc-123" } as Reference;
    mockedGet.mockResolvedValue(ref);
    const res = await getReference("abc-123");
    expect(res).toBe(ref);
  });
});

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
    const ref = makeRef([makeEnhancement(bib, "2026-01-01T00:00:00Z")]);
    expect(extractBibliographic(ref)).toBe(bib);
  });

  test("returns the most recent bibliographic enhancement by created_at", () => {
    const bib1: BibliographicMetadataEnhancement = {
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
    const bib2: BibliographicMetadataEnhancement = {
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
      makeEnhancement(bib2, "2026-01-01T00:00:00Z"),
      makeEnhancement(bib1, "2025-01-01T00:00:00Z"),
    ]);
    expect(extractBibliographic(ref)).toBe(bib2);
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
    const ref = makeRef([makeEnhancement(ld, "2026-01-01T00:00:00Z")]);
    expect(extractLinkedData(ref)).toBe(ld);
  });

  test("returns the most recent linked_data enhancement by created_at", () => {
    const ld1: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://older.com",
      data: { n: 1 },
    };
    const ld2: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://newer.com",
      data: { n: 2 },
    };
    const ref = makeRef([
      makeEnhancement(ld2, "2026-02-01T00:00:00Z"),
      makeEnhancement(ld1, "2025-01-01T00:00:00Z"),
    ]);
    expect(extractLinkedData(ref)).toBe(ld2);
  });
});
