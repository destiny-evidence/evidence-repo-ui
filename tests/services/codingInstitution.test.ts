import { describe, test, expect } from "vitest";
import {
  resolveCodingInstitution,
  extractReferenceCodingInstitution,
  extractLinkedDataCodingInstitution,
} from "@/services/codingInstitution";
import type { Enhancement, Reference } from "@/types/models";

function rawEnh(
  id: string | null,
  source: string,
  createdAt: string | null = null,
): Enhancement {
  return {
    id,
    reference_id: "ref-1",
    source,
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: createdAt,
    content: {
      enhancement_type: "raw",
    },
  };
}

function ldeEnh(
  derivedFrom: string[] | null,
  createdAt: string | null = null,
): Enhancement {
  return {
    id: "lde-1",
    reference_id: "ref-1",
    source: "robot",
    visibility: "public",
    robot_version: null,
    derived_from: derivedFrom,
    created_at: createdAt,
    content: {
      enhancement_type: "linked_data",
      vocabulary_uri: "https://vocab.example/v1",
      data: {},
    },
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

describe("resolveCodingInstitution", () => {
  test.each([
    ["eef-coder-v3", "EEF"],
    ["coder.iiie.team", "IIIE"],
    ["essa-2024", "ESSA"],
    ["wwhge-internal", "WWHGE"],
    ["EEF-CODER", "EEF"],
  ])("maps %s to %s", (input, expected) => {
    expect(resolveCodingInstitution(input)).toBe(expected);
  });

  test("returns null for unknown sources", () => {
    expect(resolveCodingInstitution("openalex")).toBeNull();
    expect(resolveCodingInstitution("robot")).toBeNull();
  });

  test("returns null for empty/null/undefined", () => {
    expect(resolveCodingInstitution("")).toBeNull();
    expect(resolveCodingInstitution(null)).toBeNull();
    expect(resolveCodingInstitution(undefined)).toBeNull();
  });
});

describe("extractReferenceCodingInstitution", () => {
  test("returns null when enhancements is null", () => {
    expect(extractReferenceCodingInstitution(makeRef(null))).toBeNull();
  });

  test("returns null when no raw enhancement exists", () => {
    expect(extractReferenceCodingInstitution(makeRef([]))).toBeNull();
  });

  test("uses the latest raw enhancement by created_at", () => {
    const ref = makeRef([
      rawEnh("a", "eef-coder", "2024-01-01"),
      rawEnh("b", "iiie-coder", "2024-06-01"),
    ]);
    expect(extractReferenceCodingInstitution(ref)).toBe("IIIE");
  });

  test("returns null when raw source is unknown", () => {
    const ref = makeRef([rawEnh("a", "openalex", "2024-01-01")]);
    expect(extractReferenceCodingInstitution(ref)).toBeNull();
  });
});

describe("extractLinkedDataCodingInstitution", () => {
  test("returns null when reference has no enhancements", () => {
    const lde = ldeEnh(["raw-1"]);
    expect(extractLinkedDataCodingInstitution(makeRef(null), lde)).toBeNull();
  });

  test("returns null when LDE has no derived_from", () => {
    const lde = ldeEnh(null);
    const ref = makeRef([rawEnh("raw-1", "eef-coder"), lde]);
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
  });

  test("resolves source on raw enhancement matched by derived_from", () => {
    const lde = ldeEnh(["raw-2"]);
    const ref = makeRef([
      rawEnh("raw-1", "openalex"),
      rawEnh("raw-2", "eef-coder-v3"),
      lde,
    ]);
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBe("EEF");
  });

  test("resolves the provenance of the specific LDE passed in", () => {
    const ldeA = { ...ldeEnh(["raw-1"]), id: "lde-a" };
    const ldeB = { ...ldeEnh(["raw-2"]), id: "lde-b" };
    const ref = makeRef([
      rawEnh("raw-1", "eef-coder"),
      rawEnh("raw-2", "iiie-coder"),
      ldeA,
      ldeB,
    ]);
    expect(extractLinkedDataCodingInstitution(ref, ldeA)).toBe("EEF");
    expect(extractLinkedDataCodingInstitution(ref, ldeB)).toBe("IIIE");
  });

  test("returns null when derived_from points to a missing enhancement", () => {
    const lde = ldeEnh(["nonexistent-id"]);
    const ref = makeRef([rawEnh("raw-1", "eef-coder"), lde]);
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
    const lde = ldeEnh(["bib-1"]);
    const ref = makeRef([bibEnh, lde]);
    expect(extractLinkedDataCodingInstitution(ref, lde)).toBeNull();
  });
});
