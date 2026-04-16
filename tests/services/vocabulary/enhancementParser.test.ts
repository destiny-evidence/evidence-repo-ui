import { describe, it, expect } from "vitest";
import { extractConceptUris } from "@/services/vocabulary/enhancementParser";

describe("extractConceptUris", () => {
  it("extracts coded concept URIs from enhancement data", () => {
    const data = {
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

    const uris = extractConceptUris(data);

    expect(uris).toContain("esea:DocumentTypeScheme/C00008");
    expect(uris).toContain("esea:EducationThemeScheme/C00040");
    expect(uris).toContain("esea:EducationLevelScheme/C00002");
    expect(uris.size).toBe(3);
  });

  it("excludes numeric coded values", () => {
    const data = {
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

    const uris = extractConceptUris(data);
    expect(uris.size).toBe(0);
  });

  it("excludes string coded values", () => {
    const data = {
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

    const uris = extractConceptUris(data);
    expect(uris.size).toBe(0);
  });

  it("returns empty set for data with no coded values", () => {
    const uris = extractConceptUris({ "@type": "Investigation" });
    expect(uris.size).toBe(0);
  });
});
