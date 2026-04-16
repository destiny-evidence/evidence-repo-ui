import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildConceptLabels,
  fetchVocabulary,
} from "@/services/vocabulary/vocabularyService";

const SAMPLE_VOCABULARY = {
  "@context": {
    skos: "http://www.w3.org/2004/02/skos/core#",
    esea: "https://vocab.esea.education/",
  },
  "@graph": [
    {
      "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
      "@type": ["skos:Concept", "esea:DocumentTypeConcept"],
      "skos:prefLabel": "Journal Article",
      "skos:inScheme": { "@id": "esea:DocumentTypeScheme" },
    },
    {
      "@id": "https://vocab.esea.education/EducationLevelScheme/C00002",
      "@type": ["skos:Concept", "esea:EducationLevelConcept"],
      "skos:prefLabel": "Primary Education",
      "skos:inScheme": { "@id": "esea:EducationLevelScheme" },
    },
    {
      "@id": "esea:DocumentTypeScheme",
      "@type": "skos:ConceptScheme",
      "rdfs:label": "Document Type Scheme",
    },
    {
      "@id": "esea:EducationLevelCodingAnnotation",
      "@type": "owl:Class",
      "rdfs:label": "Education Level Coding Annotation",
    },
  ],
};

describe("buildConceptLabels", () => {
  it("extracts labels for skos:Concept entries only", () => {
    const labels = buildConceptLabels(SAMPLE_VOCABULARY);

    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
    expect(labels.get("https://vocab.esea.education/EducationLevelScheme/C00002")).toBe(
      "Primary Education",
    );

    // ConceptScheme and owl:Class should not be included
    expect(labels.has("esea:DocumentTypeScheme")).toBe(false);
    expect(labels.has("esea:EducationLevelCodingAnnotation")).toBe(false);

    expect(labels.size).toBe(2);
  });
});

describe("fetchVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses vocabulary into a label map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_VOCABULARY), {
        status: 200,
        headers: { "Content-Type": "application/ld+json" },
      }),
    );

    const labels = await fetchVocabulary("https://vocab.example.org/v1");

    expect(fetch).toHaveBeenCalledWith("https://vocab.example.org/v1.jsonld");
    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
    expect(labels.get("https://vocab.esea.education/EducationLevelScheme/C00002")).toBe(
      "Primary Education",
    );
  });

  it("throws on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404 }),
    );

    await expect(fetchVocabulary("https://vocab.example.org/v1")).rejects.toThrow(
      "Failed to fetch vocabulary: 404",
    );
  });
});
