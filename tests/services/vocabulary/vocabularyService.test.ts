import { describe, it, expect, vi, beforeEach } from "vitest";
import { graph, parse } from "rdflib";
import {
  buildConceptLabels,
  fetchVocabulary,
} from "@/services/vocabulary/vocabularyService";

const SAMPLE_VOCABULARY_JSONLD = JSON.stringify({
  "@context": {
    skos: "http://www.w3.org/2004/02/skos/core#",
    esea: "https://vocab.esea.education/",
    owl: "http://www.w3.org/2002/07/owl#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
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
});

describe("buildConceptLabels", () => {
  it("extracts labels for skos:Concept entries only", () => {
    const store = graph();
    parse(
      SAMPLE_VOCABULARY_JSONLD,
      store,
      "https://example.org/vocab",
      "application/ld+json",
    );

    // rdflib JSON-LD parsing is async via callback, but for small docs
    // the store is populated synchronously before the callback fires.
    // Use a short delay to be safe.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const { byUri, byIdentifier } = buildConceptLabels(store);

        expect(byUri.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
          "Journal Article",
        );
        expect(byUri.get("https://vocab.esea.education/EducationLevelScheme/C00002")).toBe(
          "Primary Education",
        );

        // ConceptScheme and owl:Class should not be included
        expect(byUri.has("https://vocab.esea.education/DocumentTypeScheme")).toBe(false);
        expect(byUri.has("https://vocab.esea.education/EducationLevelCodingAnnotation")).toBe(
          false,
        );

        expect(byUri.size).toBe(2);

        // TEMPORARY WORKAROUND (taxonomy-builder#194): identifier fallback
        expect(byIdentifier.get("C00008")).toBe("Journal Article");
        expect(byIdentifier.get("C00002")).toBe("Primary Education");
        resolve();
      }, 100);
    });
  });
});

describe("fetchVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses vocabulary into a label map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(SAMPLE_VOCABULARY_JSONLD, {
        status: 200,
        headers: { "Content-Type": "application/ld+json" },
      }),
    );

    const { byUri } = await fetchVocabulary("https://vocab.example.org/v1");

    expect(fetch).toHaveBeenCalledWith("https://vocab.example.org/v1.jsonld");
    expect(byUri.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
    expect(byUri.get("https://vocab.esea.education/EducationLevelScheme/C00002")).toBe(
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
