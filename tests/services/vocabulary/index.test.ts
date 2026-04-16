import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedVocabulary, extractConceptUris } from "@/services/vocabulary";

const SAMPLE_VOCABULARY_JSONLD = JSON.stringify({
  "@context": {
    skos: "http://www.w3.org/2004/02/skos/core#",
    esea: "https://vocab.esea.education/",
  },
  "@graph": [
    {
      "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
      "@type": ["skos:Concept", "esea:DocumentTypeConcept"],
      "skos:prefLabel": "Journal Article",
    },
    {
      "@id": "https://vocab.esea.education/EducationLevelScheme/C00002",
      "@type": ["skos:Concept", "esea:EducationLevelConcept"],
      "skos:prefLabel": "Primary Education",
    },
  ],
});

describe("getCachedVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a label map keyed by full URI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, { status: 200 }),
    );

    const labels = await getCachedVocabulary("https://vocab.example.org/v1");

    expect(
      labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008"),
    ).toBe("Journal Article");
    expect(
      labels.get("https://vocab.esea.education/EducationLevelScheme/C00002"),
    ).toBe("Primary Education");
    expect(labels.get("https://unknown/uri")).toBeUndefined();
  });
});

describe("extractConceptUris", () => {
  it("extracts URI concept references from enhancement data", () => {
    const data = {
      "@type": "Investigation",
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: {
          "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
        },
      },
    };

    const uris = extractConceptUris(data);
    expect(uris).toContain(
      "https://vocab.esea.education/DocumentTypeScheme/C00008",
    );
  });
});
