import { describe, test, expect } from "vitest";
import {
  extractAbstract,
  extractBibliographic,
  extractFindingsAndEstimatesCount,
  extractLatestEnhancement,
  extractLinkedData,
  extractLinkedDataEnhancement,
  extractDoi,
  extractIdentifier,
  extractOpenAlexId,
  formatPagination,
  getInvestigation,
} from "@/services/referenceUtils";
import { makeReference } from "../fixtures";
import type {
  Reference,
  Enhancement,
  AbstractContentEnhancement,
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

function bibEnh(overrides: Partial<Enhancement> = {}): Enhancement {
  const content: BibliographicMetadataEnhancement = {
    enhancement_type: "bibliographic",
    authorship: null,
    cited_by_count: null,
    created_date: null,
    updated_date: null,
    publication_date: null,
    publication_year: null,
    publisher: null,
    title: "T",
    pagination: null,
    publication_venue: null,
  };
  return {
    id: "bib-1",
    reference_id: "ref-1",
    source: "test",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: "2024-01-01T00:00:00Z",
    content,
    ...overrides,
  };
}

describe("extractLatestEnhancement", () => {
  test("returns null when the reference has no enhancements", () => {
    expect(extractLatestEnhancement(makeRef(null), "bibliographic")).toBeNull();
  });

  test("returns null when no enhancement of that type exists", () => {
    const ref = makeRef([bibEnh()]);
    expect(extractLatestEnhancement(ref, "linked_data")).toBeNull();
  });

  test("prefers canonical (reference_id === reference.id) over newer duplicates", () => {
    const canonical = bibEnh({
      id: "bib-canon",
      reference_id: "ref-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    const duplicate = bibEnh({
      id: "bib-dup",
      reference_id: "other-ref",
      created_at: "2025-01-01T00:00:00Z",
    });
    const ref = makeRef([duplicate, canonical]);
    expect(extractLatestEnhancement(ref, "bibliographic")?.id).toBe("bib-canon");
  });

  test("within a bucket, picks the enhancement with the latest created_at", () => {
    const older = bibEnh({ id: "bib-old", created_at: "2024-01-01T00:00:00Z" });
    const newer = bibEnh({ id: "bib-new", created_at: "2024-06-01T00:00:00Z" });
    const ref = makeRef([older, newer]);
    expect(extractLatestEnhancement(ref, "bibliographic")?.id).toBe("bib-new");
  });

  test("falls back to the duplicate bucket when no canonical exists", () => {
    const dup = bibEnh({
      id: "bib-dup",
      reference_id: "other-ref",
    });
    const ref = makeRef([dup]);
    expect(extractLatestEnhancement(ref, "bibliographic")?.id).toBe("bib-dup");
  });
});

// The three wrappers below are thin shape adapters over
// `extractLatestEnhancement` — the dedup, null handling and recency
// sort are covered by its tests above. Each wrapper test below asserts
// only the shape difference: content vs full Enhancement.

describe("extractBibliographic", () => {
  test("returns the bibliographic content (not the wrapper)", () => {
    const wrapper = bibEnh();
    const ref = makeRef([wrapper]);
    expect(extractBibliographic(ref)).toBe(wrapper.content);
  });
});

describe("extractLinkedData", () => {
  test("returns the linked_data content (not the wrapper)", () => {
    const ld: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://example.com",
      data: { key: "value" },
    };
    const ref = makeRef([makeEnhancement(ld)]);
    expect(extractLinkedData(ref)).toBe(ld);
  });
});

describe("extractLinkedDataEnhancement", () => {
  test("returns the wrapping Enhancement (not just the content)", () => {
    const ld: LinkedDataEnhancement = {
      enhancement_type: "linked_data",
      vocabulary_uri: "http://example.com",
      data: { key: "value" },
    };
    const wrapper = makeEnhancement(ld);
    const ref = makeRef([wrapper]);
    expect(extractLinkedDataEnhancement(ref)).toBe(wrapper);
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

describe("extractOpenAlexId", () => {
  test("returns null when identifiers is null", () => {
    expect(extractOpenAlexId(null)).toBeNull();
  });

  test("returns null when no open_alex identifier exists", () => {
    expect(
      extractOpenAlexId([{ identifier: "10.1/x", identifier_type: "doi" }]),
    ).toBeNull();
  });

  test("returns OpenAlex string when present", () => {
    expect(
      extractOpenAlexId([
        { identifier: "W123", identifier_type: "open_alex" },
      ]),
    ).toBe("W123");
  });

  test("returns null for non-string open_alex identifier", () => {
    expect(
      extractOpenAlexId([{ identifier: 12345, identifier_type: "open_alex" }]),
    ).toBeNull();
  });
});

describe("extractIdentifier", () => {
  const IDENTIFIERS = [
    { identifier: "10.1/x", identifier_type: "doi" },
    { identifier: "W123", identifier_type: "open_alex" },
    {
      identifier: "482931",
      identifier_type: "other",
      other_identifier_name: "EPPI ItemId",
    },
  ];

  test("returns null when identifiers is null", () => {
    expect(extractIdentifier(null, { type: "open_alex" })).toBeNull();
  });

  test("matches a typed identifier", () => {
    expect(extractIdentifier(IDENTIFIERS, { type: "open_alex" })).toBe("W123");
  });

  test("matches an other-typed identifier by name", () => {
    expect(
      extractIdentifier(IDENTIFIERS, {
        type: "other",
        otherName: "EPPI ItemId",
      }),
    ).toBe("482931");
  });

  test("reads a non-string identifier as absent", () => {
    expect(
      extractIdentifier([{ identifier: 12345, identifier_type: "pm_id" }], {
        type: "pm_id",
      }),
    ).toBeNull();
  });

  test("returns null when nothing matches", () => {
    expect(extractIdentifier(IDENTIFIERS, { type: "pm_id" })).toBeNull();
    expect(
      extractIdentifier(IDENTIFIERS, { type: "other", otherName: "arxiv" }),
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

describe("extractAbstract", () => {
  test("returns null when enhancements is null", () => {
    expect(extractAbstract(makeRef(null))).toBeNull();
  });

  test("returns null when no abstract enhancement exists", () => {
    const ref = makeRef([bibEnh()]);
    expect(extractAbstract(ref)).toBeNull();
  });

  test("returns the abstract content when a single one is present", () => {
    const abs: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Body text.",
    };
    const ref = makeRef([makeEnhancement(abs)]);
    expect(extractAbstract(ref)).toBe(abs);
  });

  test("normalizes abstract text before returning it", () => {
    const abs: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "other",
      abstract: "Abstract A &gt; B",
    };
    const ref = makeRef([makeEnhancement(abs)]);
    expect(extractAbstract(ref)?.abstract).toBe("A > B");
  });

  test("longest wins within canonical bucket (W4411634320 truncation regression)", () => {
    const newerShorter: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Short closing fragment, 100 chars at most.".padEnd(100, "."),
    };
    const olderLonger: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Full intact abstract, much longer body text.".padEnd(1500, "."),
    };
    const ref = makeRef([
      makeEnhancement(newerShorter, "2026-05-01T00:00:00Z"),
      makeEnhancement(olderLonger, "2024-01-01T00:00:00Z"),
    ]);
    expect(extractAbstract(ref)).toBe(olderLonger);
  });

  test("ties broken by newest created_at when lengths are equal", () => {
    const body = "Same length abstract.".padEnd(500, ".");
    const older: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: body,
    };
    const newer: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "other",
      abstract: body,
    };
    const ref = makeRef([
      makeEnhancement(older, "2024-01-01T00:00:00Z"),
      makeEnhancement(newer, "2026-05-01T00:00:00Z"),
    ]);
    expect(extractAbstract(ref)).toBe(newer);
  });

  test("canonical bucket beats duplicate bucket even when duplicate is longer or newer", () => {
    const canonicalShorterOlder: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Canonical short body.",
    };
    const duplicateLongerNewer: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Duplicate much longer body.".padEnd(3000, "."),
    };
    const ref: Reference = {
      id: "ref-1",
      visibility: "public",
      identifiers: null,
      enhancements: [
        {
          ...makeEnhancement(canonicalShorterOlder, "2024-01-01T00:00:00Z"),
          reference_id: "ref-1",
        },
        {
          ...makeEnhancement(duplicateLongerNewer, "2026-05-01T00:00:00Z"),
          reference_id: "dup-2",
        },
      ],
    };
    expect(extractAbstract(ref)).toBe(canonicalShorterOlder);
  });

  test("falls back to duplicate bucket when canonical bucket has no abstract", () => {
    const duplicateOnly: AbstractContentEnhancement = {
      enhancement_type: "abstract",
      process: "uninverted",
      abstract: "Duplicate abstract.",
    };
    const ref: Reference = {
      id: "ref-1",
      visibility: "public",
      identifiers: null,
      enhancements: [
        {
          ...makeEnhancement(duplicateOnly),
          reference_id: "dup-2",
        },
      ],
    };
    expect(extractAbstract(ref)).toBe(duplicateOnly);
  });
});

describe("getInvestigation", () => {
  test("unwraps a bare-dict hasInvestigation", () => {
    expect(getInvestigation({ hasInvestigation: { marker: "inv" } })).toEqual({
      marker: "inv",
    });
  });

  test("takes the first element of an array-wrapped hasInvestigation", () => {
    expect(getInvestigation({ hasInvestigation: [{ marker: "inv" }] })).toEqual({
      marker: "inv",
    });
  });

  test("falls back to the root when the wrapper is omitted", () => {
    const root = { studyDesign: { "@id": "esea:C1" } };
    expect(getInvestigation(root)).toBe(root);
  });
});

describe("extractFindingsAndEstimatesCount", () => {
  test("returns null when the reference has no linked-data enhancement", () => {
    expect(extractFindingsAndEstimatesCount(makeReference({}))).toBeNull();
  });

  test("counts a bare-dict single finding and its bare-dict estimate", () => {
    const ref = makeReference({
      investigation: {
        hasFinding: { hasEffectEstimate: { pointEstimate: 0.3 } },
      },
    });
    expect(extractFindingsAndEstimatesCount(ref)).toEqual({
      findings: 1,
      estimates: 1,
    });
  });

  test("counts array-form findings and estimates unchanged", () => {
    const ref = makeReference({
      investigation: {
        hasFinding: [
          { hasEffectEstimate: [{}, {}] },
          { hasEffectEstimate: [{}] },
        ],
      },
    });
    expect(extractFindingsAndEstimatesCount(ref)).toEqual({
      findings: 2,
      estimates: 3,
    });
  });

  test("ignores non-dict entries in a findings array", () => {
    const ref = makeReference({
      investigation: {
        hasFinding: [{ hasEffectEstimate: {} }, "stray"],
      },
    });
    expect(extractFindingsAndEstimatesCount(ref)).toEqual({
      findings: 1,
      estimates: 1,
    });
  });
});
