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
  ["https://vocab.esea.education/C00086", "Cooperative Learning"],
  ["https://vocab.esea.education/C00004", "Upper Secondary"],
  ["https://vocab.esea.education/C00145", "Formal"],
  ["https://vocab.esea.education/C00123", "Basic Skills"],
  ["https://vocab.esea.education/C00122", "Curriculum"],
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

  test("returns empty findings when hasFinding is absent", () => {
    const data = makeData({});
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toEqual([]);
  });

  test("parses a single finding with full objects", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
            name: "Test intervention",
            educationTheme: [
              {
                "@type": "EducationThemeCodingAnnotation",
                codedValue: { "@id": "esea:C00086" },
                status: "evrepo:coded",
              },
            ],
            duration: {
              "@type": "NumericCodingAnnotation",
              codedValue: { "@type": "xsd:integer", "@value": 5 },
              status: "evrepo:coded",
              supportingText: "5 weeks",
            },
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
            description: "Business as usual",
          },
          hasContext: {
            "@id": "_:context",
            "@type": "Context",
            educationLevel: [
              {
                "@type": "EducationLevelCodingAnnotation",
                codedValue: { "@id": "esea:C00004" },
                status: "evrepo:coded",
              },
            ],
            setting: [
              {
                "@type": "SettingCodingAnnotation",
                codedValue: { "@id": "esea:C00145" },
                status: "evrepo:coded",
              },
            ],
            participants: [
              {
                "@type": "StringCodingAnnotation",
                codedValue: { "@type": "xsd:string", "@value": "Students" },
                status: "evrepo:coded",
              },
            ],
          },
          hasOutcome: {
            "@type": "Outcome",
            name: "Math test",
            outcome: [
              {
                "@type": "OutcomeCodingAnnotation",
                codedValue: { "@id": "esea:C00123" },
                status: "evrepo:coded",
                supportingText: "primary outcome",
              },
            ],
          },
          sampleSize: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 50 },
            status: "evrepo:coded",
          },
          attrition: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 12 },
            status: "evrepo:coded",
          },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(1);

    const finding = result.findings[0];
    expect(finding.intervention?.name).toBe("Test intervention");
    expect(finding.intervention?.educationThemes).toHaveLength(1);
    expect(finding.intervention?.educationThemes?.[0].value.label).toBe(
      "Cooperative Learning",
    );
    expect(finding.intervention?.duration?.value).toBe(5);
    expect(finding.intervention?.duration?.supportingText).toBe("5 weeks");
    expect(finding.control?.description).toBe("Business as usual");
    expect(finding.context?.educationLevels).toHaveLength(1);
    expect(finding.context?.settings).toHaveLength(1);
    expect(finding.context?.participants).toHaveLength(1);
    expect(finding.context?.participants?.[0].value).toBe("Students");
    expect(finding.outcome?.name).toBe("Math test");
    expect(finding.outcome?.outcomes).toHaveLength(1);
    expect(finding.outcome?.outcomes?.[0].supportingText).toBe(
      "primary outcome",
    );
    expect(finding.sampleSize?.value).toBe(50);
    expect(finding.attrition?.value).toBe(12);
  });

  test("resolves blank node references across findings", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
            name: "Original intervention",
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
            description: "Control group",
          },
          hasContext: {
            "@id": "_:context",
            "@type": "Context",
          },
          hasOutcome: { "@type": "Outcome", name: "Outcome 1" },
        },
        {
          "@type": "Finding",
          evaluates: "_:intervention",
          comparedTo: "_:control",
          hasContext: "_:context",
          hasOutcome: { "@type": "Outcome", name: "Outcome 2" },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].intervention?.name).toBe(
      "Original intervention",
    );
    expect(result.findings[1].intervention?.name).toBe(
      "Original intervention",
    );
    expect(result.findings[1].interventionRef).toBe("_:intervention");
    expect(result.findings[1].controlRef).toBe("_:control");
    expect(result.findings[1].contextRef).toBe("_:context");
  });

  test("skips annotations with notReported status in findings", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:int",
            "@type": "Intervention",
            educationTheme: [
              {
                "@type": "EducationThemeCodingAnnotation",
                codedValue: { "@id": "esea:C00086" },
                status: "evrepo:notReported",
              },
            ],
          },
          comparedTo: { "@id": "_:ctrl", "@type": "ControlCondition" },
          hasContext: { "@id": "_:ctx", "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
          sampleSize: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 100 },
            status: "evrepo:notApplicable",
          },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    const finding = result.findings[0];
    expect(finding.intervention?.educationThemes).toBeUndefined();
    expect(finding.sampleSize).toBeUndefined();
  });

  test("parses new intervention, context, and finding fields", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:int",
            "@type": "Intervention",
            implementerType: {
              "@type": "ImplementerTypeCodingAnnotation",
              codedValue: { "@id": "esea:C00086" },
              status: "evrepo:coded",
            },
            implementationFidelity: {
              "@type": "ImplementationFidelityCodingAnnotation",
              codedValue: { "@id": "esea:C00086" },
              status: "evrepo:coded",
            },
            implementationName: {
              "@type": "StringCodingAnnotation",
              codedValue: { "@type": "xsd:string", "@value": "Impl name" },
              status: "evrepo:coded",
            },
            implementationDescription: [
              {
                "@type": "StringCodingAnnotation",
                codedValue: { "@type": "xsd:string", "@value": "Impl desc" },
                status: "evrepo:coded",
              },
            ],
            funderIntervention: {
              "@type": "StringCodingAnnotation",
              codedValue: { "@type": "xsd:string", "@value": "Funder X" },
              status: "evrepo:coded",
            },
          },
          comparedTo: { "@id": "_:ctrl", "@type": "ControlCondition" },
          hasContext: {
            "@id": "_:ctx",
            "@type": "Context",
            country: {
              "@type": "StringCodingAnnotation",
              codedValue: { "@type": "xsd:string", "@value": "Netherlands" },
              status: "evrepo:coded",
            },
            countryLevel1: {
              "@type": "StringCodingAnnotation",
              codedValue: { "@type": "xsd:string", "@value": "North Holland" },
              status: "evrepo:coded",
            },
          },
          hasOutcome: { "@type": "Outcome" },
          cost: {
            "@type": "StringCodingAnnotation",
            codedValue: { "@type": "xsd:string", "@value": "Not reported" },
            status: "evrepo:coded",
          },
          groupDifferences: {
            "@type": "StringCodingAnnotation",
            codedValue: { "@type": "xsd:string", "@value": "Balanced" },
            status: "evrepo:coded",
          },
          sampleFeatures: [
            {
              "@type": "SampleFeaturesCodingAnnotation",
              codedValue: { "@id": "esea:C00086" },
              status: "evrepo:coded",
            },
          ],
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    const f = result.findings[0];
    expect(f.intervention?.implementerType?.value.label).toBe("Cooperative Learning");
    expect(f.intervention?.implementationFidelity?.value.label).toBe(
      "Cooperative Learning",
    );
    expect(f.intervention?.implementationName?.value).toBe("Impl name");
    expect(f.intervention?.implementationDescriptions?.[0].value).toBe("Impl desc");
    expect(f.intervention?.funderIntervention?.value).toBe("Funder X");
    expect(f.context?.countries?.[0].value).toBe("Netherlands");
    expect(f.context?.countryLevel1?.value).toBe("North Holland");
    expect(f.cost?.value).toBe("Not reported");
    expect(f.groupDifferences?.value).toBe("Balanced");
    expect(f.sampleFeatures).toHaveLength(1);
    expect(f.sampleFeatures?.[0].value.label).toBe("Cooperative Learning");
  });

  test("resolves sampleSize blank node references across findings", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: { "@id": "_:int", "@type": "Intervention" },
          comparedTo: { "@id": "_:ctrl", "@type": "ControlCondition" },
          hasContext: { "@id": "_:ctx", "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
          sampleSize: {
            "@id": "_:sampleSize",
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 47 },
            status: "evrepo:coded",
          },
        },
        {
          "@type": "Finding",
          evaluates: "_:int",
          comparedTo: "_:ctrl",
          hasContext: "_:ctx",
          sampleSize: "_:sampleSize",
          hasOutcome: { "@type": "Outcome" },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].sampleSize?.value).toBe(47);
    expect(result.findings[1].sampleSize?.value).toBe(47);
  });

  test("parses effect estimates with CI bounds, metric, and adjustment flags", () => {
    const labels = new Map([
      ...LABELS,
      ["https://vocab.evidence-repository.org/HEDGES_G", "Hedges' g"],
      [
        "https://vocab.evidence-repository.org/COMPUTED",
        "Computed from summary statistics",
      ],
    ]);
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          hasArmData: [
            {
              "@id": "_:armI",
              "@type": "ObservedResult",
              forCondition: "_:int",
              n: 222,
            },
            {
              "@id": "_:armC",
              "@type": "ObservedResult",
              forCondition: "_:ctrl",
              n: 222,
            },
          ],
          hasEffectEstimate: [
            {
              "@type": "EffectEstimate",
              pointEstimate: -0.48,
              standardError: 0.096,
              confidenceIntervalLower: -0.67,
              confidenceIntervalUpper: -0.29,
              effectSizeMetric: "evrepo:HEDGES_G",
              estimateSource: "evrepo:COMPUTED",
              baselineAdjusted: true,
              clusteringAdjusted: "no",
              derivedFrom: ["_:armI", "_:armC"],
            },
          ],
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, labels);
    const finding = result.findings[0];

    expect(finding.effectEstimates).toHaveLength(1);
    const ee = finding.effectEstimates![0];
    expect(ee.pointEstimate).toBe(-0.48);
    expect(ee.standardError).toBe(0.096);
    expect(ee.ciLower).toBe(-0.67);
    expect(ee.ciUpper).toBe(-0.29);
    expect(ee.effectSizeMetric?.label).toBe("Hedges' g");
    expect(ee.estimateSource?.label).toBe("Computed from summary statistics");
    expect(ee.baselineAdjusted).toBe(true);
    expect(ee.clusteringAdjusted).toBe("no");
    expect(ee.derivedFromIds).toEqual(["_:armI", "_:armC"]);

    expect(finding.arms).toHaveLength(2);
    expect(finding.arms![0]).toMatchObject({
      id: "_:armI",
      conditionRef: "_:int",
      n: 222,
    });
  });

  test("parses sparse arm data: only n populated, other fields undefined", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          hasArmData: [
            {
              "@id": "_:armI",
              "@type": "ObservedResult",
              forCondition: "_:int",
              n: 50,
            },
          ],
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    const arm = result.findings[0].arms![0];
    expect(arm.n).toBe(50);
    expect(arm.mean).toBeUndefined();
    expect(arm.sd).toBeUndefined();
    expect(arm.se).toBeUndefined();
  });

  test("handles forCondition as object reference with @id", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          hasArmData: [
            {
              "@id": "_:armI",
              "@type": "ObservedResult",
              forCondition: { "@id": "_:int" },
              n: 12,
            },
          ],
        },
      ],
    });
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].arms![0].conditionRef).toBe("_:int");
  });

  test("findings without effect estimates or arms leave fields undefined", () => {
    const data = makeData({
      hasFinding: [{ "@type": "Finding" }],
    });
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].effectEstimates).toBeUndefined();
    expect(result.findings[0].arms).toBeUndefined();
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
