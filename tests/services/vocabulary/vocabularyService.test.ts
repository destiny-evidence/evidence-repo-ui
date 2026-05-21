import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildVocabularyData,
  fetchVocabulary,
  getCachedVocabulary,
  _resetVocabularyCache,
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
      "@id": "https://vocab.esea.education/EducationThemeScheme/C00022",
      "@type": ["skos:Concept", "esea:EducationThemeConcept"],
      "skos:prefLabel": "School Organization",
    },
    {
      "@id": "https://vocab.esea.education/EducationThemeScheme/C00074",
      "@type": ["skos:Concept", "esea:EducationThemeConcept"],
      "skos:prefLabel": "Literacy and Reading Interventions",
      "skos:broader": "https://vocab.esea.education/EducationThemeScheme/C00022",
    },
    {
      "@id": "https://vocab.esea.education/EducationThemeScheme/C00075",
      "@type": ["skos:Concept", "esea:EducationThemeConcept"],
      "skos:prefLabel": "Class Size",
      "skos:broader": {
        "@id": "https://vocab.esea.education/EducationThemeScheme/C00022",
      },
    },
    {
      "@id": "esea:DocumentTypeScheme",
      "@type": "skos:ConceptScheme",
      "dct:title": "Document Type",
      "skos:hasTopConcept": [
        {
          "@id": "https://vocab.esea.education/DocumentTypeScheme/C00008",
        },
      ],
    },
    {
      "@id": "esea:EducationThemeScheme",
      "@type": "skos:ConceptScheme",
      "rdfs:label": "Education Theme Scheme",
      "skos:hasTopConcept": {
        "@id": "https://vocab.esea.education/EducationThemeScheme/C00022",
      },
    },
    {
      "@id": "esea:EducationLevelCodingAnnotation",
      "@type": "owl:Class",
      "rdfs:label": "Education Level Coding Annotation",
    },
  ],
};

describe("buildVocabularyData", () => {
  it("extracts labels for skos:Concept entries only", () => {
    const { labels } = buildVocabularyData(SAMPLE_VOCABULARY);

    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
    expect(labels.get("https://vocab.esea.education/EducationLevelScheme/C00002")).toBe(
      "Primary Education",
    );

    // ConceptScheme and owl:Class should not be included
    expect(labels.has("esea:DocumentTypeScheme")).toBe(false);
    expect(labels.has("esea:EducationLevelCodingAnnotation")).toBe(false);
  });

  it("extracts broader relationships between concepts", () => {
    const { broader } = buildVocabularyData(SAMPLE_VOCABULARY);

    expect(
      broader.get("https://vocab.esea.education/EducationThemeScheme/C00074"),
    ).toBe("https://vocab.esea.education/EducationThemeScheme/C00022");

    // Concepts without broader are not in the map
    expect(
      broader.has("https://vocab.esea.education/DocumentTypeScheme/C00008"),
    ).toBe(false);
  });

  it("handles broader values as objects with @id", () => {
    const { broader } = buildVocabularyData({
      "@graph": [
        {
          "@id": "u:child",
          "@type": "skos:Concept",
          "skos:prefLabel": "Child",
          "skos:broader": { "@id": "u:parent" },
        },
      ],
    });
    expect(broader.get("u:child")).toBe("u:parent");
  });

  it("extracts skos:definition for concepts that have it", () => {
    const { definitions } = buildVocabularyData({
      "@graph": [
        {
          "@id": "u:journal",
          "@type": "skos:Concept",
          "skos:prefLabel": "Journal Article",
          "skos:definition":
            "Peer-reviewed publication presenting original research or reviews.",
        },
        {
          "@id": "u:book",
          "@type": "skos:Concept",
          "skos:prefLabel": "Book",
        },
      ],
    });
    expect(definitions.get("u:journal")).toBe(
      "Peer-reviewed publication presenting original research or reviews.",
    );
    expect(definitions.has("u:book")).toBe(false);
  });

  it("extracts concept schemes with title and top concepts", () => {
    const { schemes } = buildVocabularyData(SAMPLE_VOCABULARY);

    expect(schemes.get("esea:DocumentTypeScheme")).toEqual({
      title: "Document Type",
      topConcepts: ["https://vocab.esea.education/DocumentTypeScheme/C00008"],
    });
    // Accepts a single (non-array) skos:hasTopConcept and rdfs:label fallback.
    expect(schemes.get("esea:EducationThemeScheme")).toEqual({
      title: "Education Theme Scheme",
      topConcepts: ["https://vocab.esea.education/EducationThemeScheme/C00022"],
    });
  });

  it("skips ConceptScheme entries with no title", () => {
    const { schemes } = buildVocabularyData({
      "@graph": [
        {
          "@id": "u:scheme",
          "@type": "skos:ConceptScheme",
        },
      ],
    });
    expect(schemes.has("u:scheme")).toBe(false);
  });

  it("derives narrower as the inverse of broader", () => {
    const { narrower } = buildVocabularyData(SAMPLE_VOCABULARY);

    expect(
      narrower.get("https://vocab.esea.education/EducationThemeScheme/C00022"),
    ).toEqual([
      "https://vocab.esea.education/EducationThemeScheme/C00074",
      "https://vocab.esea.education/EducationThemeScheme/C00075",
    ]);
    // Leaf concepts have no narrower entry.
    expect(
      narrower.has("https://vocab.esea.education/EducationThemeScheme/C00074"),
    ).toBe(false);
  });
});

describe("fetchVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses vocabulary into labels and broader maps", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_VOCABULARY), {
        status: 200,
        headers: { "Content-Type": "application/ld+json" },
      }),
    );

    const { labels, broader } = await fetchVocabulary("https://vocab.example.org/v1");

    expect(fetch).toHaveBeenCalledWith("https://vocab.example.org/v1.jsonld");
    expect(labels.get("https://vocab.esea.education/DocumentTypeScheme/C00008")).toBe(
      "Journal Article",
    );
    expect(
      broader.get("https://vocab.esea.education/EducationThemeScheme/C00074"),
    ).toBe("https://vocab.esea.education/EducationThemeScheme/C00022");
  });

  it("normalizes non-jsonld URLs to .jsonld", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_VOCABULARY), { status: 200 }),
    );

    await fetchVocabulary("https://vocab.example.org/v1.ttl");

    expect(fetch).toHaveBeenCalledWith("https://vocab.example.org/v1.jsonld");
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

describe("getCachedVocabulary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetVocabularyCache();
  });

  it("deduplicates concurrent requests for the same URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_VOCABULARY), { status: 200 }),
    );

    const [a, b] = await Promise.all([
      getCachedVocabulary("https://vocab.example.org/v2"),
      getCachedVocabulary("https://vocab.example.org/v2"),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});
