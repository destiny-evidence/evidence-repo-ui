import { describe, test, expect } from "vitest";
import { rawSourcePatterns } from "@/services/codingInstitution";
import type { Enhancement, Reference } from "@/types/models";
import { linkedDataEnh, makeReference, rawEnh } from "../fixtures";

// esea-style patterns; the factory itself is community-agnostic.
const coding = rawSourcePatterns([
  [/(^|[^a-z])eef([^a-z]|$)/, "EEF"],
  [/(^|[^a-z])iiie([^a-z]|$)/, "IIIE"],
  [/(^|[^a-z])essa([^a-z]|$)/, "ESSA"],
  [/(^|[^a-z])wwhge([^a-z]|$)/, "WWHGE"],
]);

function refWithRawSource(source: string): Reference {
  return makeReference({
    enhancements: [rawEnh("ref-1", { id: "a", source, createdAt: "2024-01-01" })],
  });
}

describe("rawSourcePatterns source matching", () => {
  test.each([
    ["eef-eppi-review", "EEF"],
    ["ad_hoc_ingestors.iiie_ingestor@1.0", "IIIE"],
    ["ad_hoc_ingestors.essa_ingestor@1.0", "ESSA"],
    ["wwhge-internal", "WWHGE"],
    ["EEF-EPPI-REVIEW", "EEF"],
  ])("maps %s to %s", (input, expected) => {
    expect(coding.fromReference(refWithRawSource(input))).toBe(expected);
  });

  test("returns null for unknown sources", () => {
    expect(coding.fromReference(refWithRawSource("openalex"))).toBeNull();
    expect(coding.fromReference(refWithRawSource("robot"))).toBeNull();
  });

  test("does not match patterns embedded in larger words", () => {
    // "beef" should not match "eef"; "messaging" should not match "essa".
    expect(coding.fromReference(refWithRawSource("beef"))).toBeNull();
    expect(coding.fromReference(refWithRawSource("messaging"))).toBeNull();
  });
});

describe("fromReference", () => {
  test("returns null when no raw enhancement exists", () => {
    expect(
      coding.fromReference(makeReference({ enhancements: [] })),
    ).toBeNull();
  });

  test("uses the latest raw enhancement by created_at", () => {
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", {
          id: "a",
          source: "eef-eppi-review",
          createdAt: "2024-01-01",
        }),
        rawEnh("ref-1", {
          id: "b",
          source: "ad_hoc_ingestors.iiie_ingestor@1.0",
          createdAt: "2024-06-01",
        }),
      ],
    });
    expect(coding.fromReference(ref)).toBe("IIIE");
  });
});

describe("fromLinkedData", () => {
  test("returns null when reference has no enhancements", () => {
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: ["raw-1"] });
    const ref: Reference = {
      id: "ref-1",
      visibility: "public",
      identifiers: null,
      enhancements: null,
    };
    expect(coding.fromLinkedData(ref, lde)).toBeNull();
  });

  test("returns null when LDE has no derived_from", () => {
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: null });
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", { id: "raw-1", source: "eef-eppi-review" }),
        lde,
      ],
    });
    expect(coding.fromLinkedData(ref, lde)).toBeNull();
  });

  test("resolves source on raw enhancement matched by derived_from", () => {
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: ["raw-2"] });
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", { id: "raw-1", source: "openalex" }),
        rawEnh("ref-1", { id: "raw-2", source: "eef-eppi-review-v3" }),
        lde,
      ],
    });
    expect(coding.fromLinkedData(ref, lde)).toBe("EEF");
  });

  test("resolves the provenance of the specific LDE passed in", () => {
    const ldeA = linkedDataEnh("ref-1", {
      id: "lde-a",
      derivedFrom: ["raw-1"],
    });
    const ldeB = linkedDataEnh("ref-1", {
      id: "lde-b",
      derivedFrom: ["raw-2"],
    });
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", { id: "raw-1", source: "eef-eppi-review" }),
        rawEnh("ref-1", {
          id: "raw-2",
          source: "ad_hoc_ingestors.iiie_ingestor@1.0",
        }),
        ldeA,
        ldeB,
      ],
    });
    expect(coding.fromLinkedData(ref, ldeA)).toBe("EEF");
    expect(coding.fromLinkedData(ref, ldeB)).toBe("IIIE");
  });

  test("returns null when derived_from points to a missing enhancement", () => {
    const lde = linkedDataEnh("ref-1", {
      id: "lde-1",
      derivedFrom: ["nonexistent-id"],
    });
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", { id: "raw-1", source: "eef-eppi-review" }),
        lde,
      ],
    });
    expect(coding.fromLinkedData(ref, lde)).toBeNull();
  });

  test("ignores non-raw enhancements with matching id in derived_from", () => {
    const bibEnh: Enhancement = {
      id: "bib-1",
      reference_id: "ref-1",
      source: "eef",
      visibility: "public",
      robot_version: null,
      derived_from: null,
      created_at: null,
      content: {
        enhancement_type: "bibliographic",
        authorship: null,
        cited_by_count: null,
        created_date: null,
        updated_date: null,
        publication_date: null,
        publication_year: null,
        publisher: null,
        title: null,
        pagination: null,
        publication_venue: null,
      },
    };
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: ["bib-1"] });
    const ref = makeReference({ enhancements: [bibEnh, lde] });
    expect(coding.fromLinkedData(ref, lde)).toBeNull();
  });
});
