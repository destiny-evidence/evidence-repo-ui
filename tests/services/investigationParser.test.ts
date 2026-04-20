import { describe, test, expect } from "vitest";
import {
  parseInvestigation,
  extractIsRetracted,
} from "@/services/investigationParser";

const PREFIXES = new Map([
  ["esea", "https://vocab.esea.education/"],
  ["evrepo", "https://vocab.evidence-repository.org/"],
]);

const LABELS = new Map([
  ["https://vocab.esea.education/C00008", "Journal Article"],
]);

function makeData(investigation: Record<string, unknown>) {
  return {
    "@context": "https://vocab.esea.education/context/v1.jsonld",
    "@type": "LinkedDataEnhancement",
    hasInvestigation: {
      "@type": "Investigation",
      ...investigation,
    },
  };
}

describe("parseInvestigation", () => {
  test("parses document type", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:coded",
      },
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);

    expect(result.documentType).toBeDefined();
    expect(result.documentType!.value.uri).toBe(
      "https://vocab.esea.education/C00008",
    );
    expect(result.documentType!.value.label).toBe("Journal Article");
  });

  test("returns undefined documentType when not present", () => {
    const data = makeData({});
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.documentType).toBeUndefined();
  });

  test("skips documentType with notReported status", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:notReported",
      },
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.documentType).toBeUndefined();
  });

  test("skips documentType with notApplicable status", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:notApplicable",
      },
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.documentType).toBeUndefined();
  });

  test("parses isRetracted flag", () => {
    const data = makeData({ isRetracted: true });
    expect(parseInvestigation(data, PREFIXES, LABELS).isRetracted).toBe(true);
  });

  test("defaults isRetracted to false", () => {
    const data = makeData({});
    expect(parseInvestigation(data, PREFIXES, LABELS).isRetracted).toBe(false);
  });

  test("extractIsRetracted returns true when set", () => {
    const data = makeData({ isRetracted: true });
    expect(extractIsRetracted(data)).toBe(true);
  });

  test("extractIsRetracted returns false when not set", () => {
    const data = makeData({});
    expect(extractIsRetracted(data)).toBe(false);
  });

  test("handles root as Investigation directly (no hasInvestigation wrapper)", () => {
    const data = {
      "@context": "https://vocab.esea.education/context/v1.jsonld",
      "@type": "Investigation",
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:coded",
      },
    };

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.documentType?.value.label).toBe("Journal Article");
  });

  test("returns undefined label when concept not in vocabulary", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C99999" },
        status: "evrepo:coded",
      },
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.documentType?.value.uri).toBe(
      "https://vocab.esea.education/C99999",
    );
    expect(result.documentType?.value.label).toBeUndefined();
  });
});
