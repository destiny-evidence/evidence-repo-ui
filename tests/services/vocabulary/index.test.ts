import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVocabularyResolver,
  resolveEnhancementLabels,
} from "@/services/vocabulary";

const SAMPLE_VOCABULARY_JSONLD = JSON.stringify({
  "@context": {
    skos: "http://www.w3.org/2004/02/skos/core#",
    esea: "https://vocab.esea.education/",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
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

const INLINE_CONTEXT = {
  "@vocab": "https://vocab.evidence-repository.org/",
  esea: "https://vocab.esea.education/",
  evrepo: "https://vocab.evidence-repository.org/",
  codedValue: { "@type": "@id" },
  status: { "@type": "@id" },
  documentType: { "@id": "esea:documentType", "@type": "@id" },
};

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

  it("resolves coded concept URIs to labels end-to-end", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, { status: 200 }),
    );

    const resolver = await createVocabularyResolver("https://vocab.example.org/v1");

    const enhancementData = {
      "@context": INLINE_CONTEXT,
      "@type": "Investigation",
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:DocumentTypeScheme/C00008" },
        status: "evrepo:coded",
      },
    };

    const labels = await resolveEnhancementLabels(enhancementData, resolver);

    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
  });
});
