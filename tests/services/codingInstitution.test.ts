import { describe, test, expect } from "vitest";
import {
  resolveCodingInstitution,
  extractReferenceCodingInstitution,
  extractLinkedDataCodingInstitution,
} from "@/services/codingInstitution";
import type { Enhancement, Reference } from "@/types/models";
import { linkedDataEnh, makeReference, rawEnh } from "../fixtures";

describe("resolveCodingInstitution", () => {
  test.each([
    ["eef-eppi-review", "EEF"],
    ["ad_hoc_ingestors.iiie_ingestor@1.0", "IIIE"],
    ["ad_hoc_ingestors.essa_ingestor@1.0", "ESSA"],
    ["wwhge-internal", "WWHGE"],
    ["EEF-EPPI-REVIEW", "EEF"],
  ])("maps %s to %s", (input, expected) => {
    expect(resolveCodingInstitution(input)).toBe(expected);
  });

  test("returns null for unknown sources", () => {
    expect(resolveCodingInstitution("openalex")).toBeNull();
    expect(resolveCodingInstitution("robot")).toBeNull();
  });

  test("does not match patterns embedded in larger words", () => {
    // "beef" should not match "eef"; "messa" should not match "essa"; etc.
    expect(resolveCodingInstitution("beef")).toBeNull();
    expect(resolveCodingInstitution("messaging")).toBeNull();
  });

  test("returns null for empty/null/undefined", () => {
    expect(resolveCodingInstitution("")).toBeNull();
    expect(resolveCodingInstitution(null)).toBeNull();
    expect(resolveCodingInstitution(undefined)).toBeNull();
  });
});

describe("extractReferenceCodingInstitution", () => {
  test("returns null when enhancements is null", () => {
    expect(
      extractReferenceCodingInstitution(makeReference({ enhancements: [] })),
    ).toBeNull();
  });

  test("returns null when no raw enhancement exists", () => {
    expect(
      extractReferenceCodingInstitution(makeReference({ enhancements: [] })),
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
    expect(extractReferenceCodingInstitution(ref)).toBe("IIIE");
  });

  test("returns null when raw source is unknown", () => {
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", {
          id: "a",
          source: "openalex",
          createdAt: "2024-01-01",
        }),
      ],
    });
    expect(extractReferenceCodingInstitution(ref)).toBeNull();
  });
});

describe("extractLinkedDataCodingInstitution", () => {
  test("returns null when reference has no enhancements", () => {
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: ["raw-1"] });
    const ref: Reference = {
      id: "ref-1",
      visibility: "public",
      identifiers: null,
      enhancements: null,
    };
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
  });

  test("returns null when LDE has no derived_from", () => {
    const lde = linkedDataEnh("ref-1", { id: "lde-1", derivedFrom: null });
    const ref = makeReference({
      enhancements: [
        rawEnh("ref-1", { id: "raw-1", source: "eef-eppi-review" }),
        lde,
      ],
    });
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
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
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBe("EEF");
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
    expect(extractLinkedDataCodingInstitution(ref, ldeA)).toBe("EEF");
    expect(extractLinkedDataCodingInstitution(ref, ldeB)).toBe("IIIE");
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
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
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
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
  });
});
