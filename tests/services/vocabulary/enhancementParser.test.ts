import { describe, it, expect } from "vitest";
import { extractConceptUris } from "@/services/vocabulary/enhancementParser";

// Inline context so rdflib can expand compact URIs without remote fetch.
const INLINE_CONTEXT = {
  "@vocab": "https://vocab.evidence-repository.org/",
  esea: "https://vocab.esea.education/",
  evrepo: "https://vocab.evidence-repository.org/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  codedValue: { "@type": "@id" },
  status: { "@type": "@id" },
  hasFinding: { "@type": "@id" },
  hasContext: { "@type": "@id" },
  hasOutcome: { "@type": "@id" },
  educationLevel: { "@id": "esea:educationLevel", "@type": "@id", "@container": "@set" },
  documentType: { "@id": "esea:documentType", "@type": "@id" },
  setting: { "@id": "esea:setting", "@type": "@id", "@container": "@set" },
  outcome: { "@id": "esea:outcome", "@type": "@id", "@container": "@set" },
  sampleFeatures: { "@id": "esea:sampleFeatures", "@type": "@id", "@container": "@set" },
  educationTheme: { "@id": "esea:educationTheme", "@type": "@id", "@container": "@set" },
  evaluates: { "@type": "@id" },
  comparedTo: { "@type": "@id" },
  sampleSize: { "@id": "esea:sampleSize", "@type": "@id" },
  duration: { "@id": "esea:duration", "@type": "@id" },
};

describe("extractConceptUris", () => {
  it("extracts coded concept URIs from enhancement data", async () => {
    const data = {
      "@context": INLINE_CONTEXT,
      "@type": "Investigation",
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:DocumentTypeScheme/C00008" },
        status: "evrepo:coded",
      },
      hasFinding: [
        {
          "@type": "Finding",
          educationTheme: [
            {
              "@type": "EducationThemeCodingAnnotation",
              codedValue: { "@id": "esea:EducationThemeScheme/C00040" },
              status: "evrepo:coded",
            },
          ],
          hasContext: {
            "@type": "Context",
            educationLevel: [
              {
                "@type": "EducationLevelCodingAnnotation",
                codedValue: { "@id": "esea:EducationLevelScheme/C00002" },
                status: "evrepo:coded",
              },
            ],
          },
        },
      ],
    };

    const uris = await extractConceptUris(data);

    expect(uris).toContain("https://vocab.esea.education/DocumentTypeScheme/C00008");
    expect(uris).toContain("https://vocab.esea.education/EducationThemeScheme/C00040");
    expect(uris).toContain("https://vocab.esea.education/EducationLevelScheme/C00002");
    expect(uris.size).toBe(3);
  });

  it("excludes numeric coded values", async () => {
    const data = {
      "@context": INLINE_CONTEXT,
      "@type": "Investigation",
      hasFinding: [
        {
          "@type": "Finding",
          sampleSize: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 667 },
            status: "evrepo:coded",
          },
        },
      ],
    };

    const uris = await extractConceptUris(data);
    expect(uris.size).toBe(0);
  });

  it("excludes string coded values", async () => {
    const data = {
      "@context": INLINE_CONTEXT,
      "@type": "Investigation",
      hasFinding: [
        {
          "@type": "Finding",
          hasContext: {
            "@type": "Context",
            participants: [
              {
                "@type": "StringCodingAnnotation",
                codedValue: { "@type": "xsd:string", "@value": "Students" },
                status: "evrepo:coded",
              },
            ],
          },
        },
      ],
    };

    const uris = await extractConceptUris(data);
    expect(uris.size).toBe(0);
  });

  it("returns empty set for data with no coded values", async () => {
    const data = {
      "@context": INLINE_CONTEXT,
      "@type": "Investigation",
    };

    const uris = await extractConceptUris(data);
    expect(uris.size).toBe(0);
  });
});
