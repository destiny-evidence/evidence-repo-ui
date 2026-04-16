import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVocabularyResolver,
  resolveEnhancementLabels,
} from "@/services/vocabulary";

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

describe("createVocabularyResolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a resolver that looks up labels by full URI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, { status: 200 }),
    );

    const resolver = await createVocabularyResolver("https://vocab.example.org/v1");

    expect(
      resolver.getLabel("https://vocab.esea.education/DocumentTypeScheme/C00008"),
    ).toBe("Journal Article");
    expect(
      resolver.getLabel("https://vocab.esea.education/EducationLevelScheme/C00002"),
    ).toBe("Primary Education");
    expect(resolver.getLabel("https://unknown/uri")).toBeUndefined();
  });
});

describe("resolveEnhancementLabels", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves concept URIs to labels when URIs are already expanded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, { status: 200 }),
    );

    const resolver = await createVocabularyResolver("https://vocab.example.org/v1");

    // Enhancement data with full URIs (as they would be after context expansion)
    const enhancementData = {
      "@type": "Investigation",
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: {
          "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
        },
      },
    };

    const labels = resolveEnhancementLabels(enhancementData, resolver);

    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
  });
});
