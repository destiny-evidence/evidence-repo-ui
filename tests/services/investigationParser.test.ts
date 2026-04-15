import { describe, test, expect } from "vitest";
import { parseInvestigation } from "@/services/investigationParser";

const PREFIXES = new Map([
  ["esea", "https://vocab.esea.education/"],
  ["evrepo", "https://vocab.evidence-repository.org/"],
  ["xsd", "http://www.w3.org/2001/XMLSchema#"],
]);

const LABELS = new Map([
  ["https://vocab.esea.education/C00008", "Journal Article"],
  ["https://vocab.esea.education/C00074", "Reading"],
  ["https://vocab.esea.education/C00072", "Literacy"],
  ["https://vocab.esea.education/C00002", "Lower Primary"],
  ["https://vocab.esea.education/C00145", "School"],
  ["https://vocab.esea.education/C00123", "Academic achievement"],
  ["https://vocab.esea.education/C00189", "Socio-economic disadvantage"],
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

const FINDING_WITH_ALL_FIELDS = {
  "@type": "Finding",
  sampleSize: {
    "@id": "_:sampleSize",
    "@type": "NumericCodingAnnotation",
    codedValue: { "@type": "xsd:integer", "@value": 47 },
    status: "evrepo:coded",
    supportingText: "47 students",
  },
  evaluates: {
    "@id": "_:intervention",
    "@type": "Intervention",
    name: "Reciprocal teaching",
    description: ["Page 10: The teacher explains..."],
    educationTheme: [
      {
        "@type": "EducationThemeCodingAnnotation",
        codedValue: { "@id": "esea:C00074" },
        status: "evrepo:coded",
      },
      {
        "@type": "EducationThemeCodingAnnotation",
        codedValue: { "@id": "esea:C00072" },
        status: "evrepo:coded",
      },
    ],
    duration: {
      "@type": "NumericCodingAnnotation",
      codedValue: { "@type": "xsd:integer", "@value": 1 },
      status: "evrepo:coded",
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
        codedValue: { "@id": "esea:C00002" },
        status: "evrepo:coded",
        supportingText: "Special schools",
      },
    ],
    participants: [
      {
        "@type": "StringCodingAnnotation",
        codedValue: { "@type": "xsd:string", "@value": "Students" },
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
    sampleFeatures: [
      {
        "@type": "SampleFeaturesCodingAnnotation",
        codedValue: { "@id": "esea:C00189" },
        status: "evrepo:coded",
      },
    ],
  },
  hasArmData: [
    {
      "@id": "_:obs1_intervention",
      "@type": "ObservedResult",
      forCondition: "_:intervention",
      mean: 20.5,
      n: 16,
      sd: 6.1,
    },
    {
      "@id": "_:obs1_control",
      "@type": "ObservedResult",
      forCondition: "_:control",
      mean: 19.5,
      n: 15,
      sd: 5.6,
    },
  ],
  hasEffectEstimate: [
    {
      "@type": "EffectEstimate",
      pointEstimate: 0.166,
      standardError: 0.36,
      confidenceIntervalLower: -0.54,
      confidenceIntervalUpper: 0.87,
      effectSizeMetric: "evrepo:hedgesG",
      baselineAdjusted: false,
      clusteringAdjusted: "no",
      derivedFrom: ["_:obs1_intervention", "_:obs1_control"],
    },
  ],
  hasOutcome: {
    "@type": "Outcome",
    name: "Reading comprehension",
    description: "Standardised reading test",
    outcome: [
      {
        "@type": "OutcomeCodingAnnotation",
        codedValue: { "@id": "esea:C00123" },
        status: "evrepo:coded",
      },
    ],
  },
};

describe("parseInvestigation", () => {
  test("parses document type", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:coded",
      },
      hasFinding: [],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);

    expect(result.documentType).toBeDefined();
    expect(result.documentType!.value.uri).toBe(
      "https://vocab.esea.education/C00008",
    );
    expect(result.documentType!.value.label).toBe("Journal Article");
  });

  test("parses isRetracted flag", () => {
    const data = makeData({ isRetracted: true, hasFinding: [] });
    expect(parseInvestigation(data, PREFIXES, LABELS).isRetracted).toBe(
      true,
    );
  });

  test("defaults isRetracted to false", () => {
    const data = makeData({ hasFinding: [] });
    expect(parseInvestigation(data, PREFIXES, LABELS).isRetracted).toBe(
      false,
    );
  });

  test("parses a single finding with all fields", () => {
    const data = makeData({
      documentType: {
        "@type": "DocumentTypeCodingAnnotation",
        codedValue: { "@id": "esea:C00008" },
        status: "evrepo:coded",
      },
      hasFinding: [FINDING_WITH_ALL_FIELDS],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(1);

    const finding = result.findings[0];

    // Intervention
    expect(finding.intervention.name).toBe("Reciprocal teaching");
    expect(finding.intervention.descriptions).toEqual([
      "Page 10: The teacher explains...",
    ]);
    expect(finding.intervention.educationThemes).toHaveLength(2);
    expect(finding.intervention.educationThemes[0].value.label).toBe(
      "Reading",
    );
    expect(finding.intervention.educationThemes[1].value.label).toBe(
      "Literacy",
    );
    expect(finding.intervention.duration?.value).toBe(1);

    // Control
    expect(finding.control.descriptions).toEqual(["Business as usual"]);

    // Context
    expect(finding.context.educationLevels).toHaveLength(1);
    expect(finding.context.educationLevels[0].value.label).toBe(
      "Lower Primary",
    );
    expect(finding.context.educationLevels[0].supportingText).toBe(
      "Special schools",
    );
    expect(finding.context.settings[0].value.label).toBe("School");
    expect(finding.context.participants[0].value).toBe("Students");
    expect(finding.context.sampleFeatures[0].value.label).toBe(
      "Socio-economic disadvantage",
    );

    // Outcome
    expect(finding.outcome.name).toBe("Reading comprehension");
    expect(finding.outcome.outcomeConcepts[0].value.label).toBe(
      "Academic achievement",
    );

    // Sample size
    expect(finding.sampleSize?.value).toBe(47);
    expect(finding.sampleSize?.supportingText).toBe("47 students");

    // Arm data
    expect(finding.armData).toHaveLength(2);
    expect(finding.armData[0].forCondition).toBe("intervention");
    expect(finding.armData[0].mean).toBe(20.5);
    expect(finding.armData[0].n).toBe(16);
    expect(finding.armData[1].forCondition).toBe("control");

    // Effect estimates
    expect(finding.effectEstimates).toHaveLength(1);
    expect(finding.effectEstimates[0].pointEstimate).toBe(0.166);
    expect(finding.effectEstimates[0].effectSizeMetric).toBe(
      "https://vocab.evidence-repository.org/hedgesG",
    );
    expect(finding.effectEstimates[0].derivedFromIds).toEqual([
      "_:obs1_intervention",
      "_:obs1_control",
    ]);
  });

  test("skips annotations with notReported status", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
            educationTheme: [
              {
                "@type": "EducationThemeCodingAnnotation",
                codedValue: { "@id": "esea:C00074" },
                status: "evrepo:notReported",
              },
            ],
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
          },
          hasContext: { "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].intervention.educationThemes).toHaveLength(0);
  });

  test("skips annotations with notApplicable status", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          sampleSize: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 100 },
            status: "evrepo:notApplicable",
          },
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
          },
          hasContext: { "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].sampleSize).toBeUndefined();
  });

  test("resolves shared nodes across multiple findings", () => {
    const data = makeData({
      hasFinding: [
        FINDING_WITH_ALL_FIELDS,
        {
          "@type": "Finding",
          sampleSize: "_:sampleSize",
          evaluates: "_:intervention",
          comparedTo: "_:control",
          hasContext: "_:context",
          hasArmData: [
            {
              "@id": "_:obs2_intervention",
              "@type": "ObservedResult",
              forCondition: "_:intervention",
              n: 222,
            },
            {
              "@id": "_:obs2_control",
              "@type": "ObservedResult",
              forCondition: "_:control",
              n: 222,
            },
          ],
          hasEffectEstimate: [
            {
              "@type": "EffectEstimate",
              pointEstimate: -0.48,
              effectSizeMetric: "evrepo:hedgesG",
              derivedFrom: ["_:obs2_intervention", "_:obs2_control"],
            },
          ],
          hasOutcome: {
            "@type": "Outcome",
            name: "AVERAGE_ITBS",
            outcome: [
              {
                "@type": "OutcomeCodingAnnotation",
                codedValue: { "@id": "esea:C00123" },
                status: "evrepo:coded",
              },
            ],
          },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(2);

    // Second finding reuses shared nodes
    const f2 = result.findings[1];
    expect(f2.intervention.name).toBe("Reciprocal teaching");
    expect(f2.control.descriptions).toEqual(["Business as usual"]);
    expect(f2.context.educationLevels[0].value.label).toBe("Lower Primary");
    expect(f2.sampleSize?.value).toBe(47);
    expect(f2.outcome.name).toBe("AVERAGE_ITBS");
    expect(f2.armData[0].forCondition).toBe("intervention");
    expect(f2.armData[0].n).toBe(222);
  });

  test("handles missing hasArmData", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
          },
          hasContext: { "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
          hasEffectEstimate: [
            {
              "@type": "EffectEstimate",
              pointEstimate: 0.33,
              effectSizeMetric: "evrepo:hedgesG",
            },
          ],
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].armData).toHaveLength(0);
    expect(result.findings[0].effectEstimates).toHaveLength(1);
  });

  test("handles empty hasFinding", () => {
    const data = makeData({ hasFinding: [] });
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(0);
  });

  test("handles missing hasFinding", () => {
    const data = makeData({});
    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(0);
  });

  test("normalizes single-element arrays (pyld compaction)", () => {
    const data = makeData({
      hasFinding: {
        "@type": "Finding",
        evaluates: {
          "@id": "_:intervention",
          "@type": "Intervention",
          educationTheme: {
            "@type": "EducationThemeCodingAnnotation",
            codedValue: { "@id": "esea:C00074" },
            status: "evrepo:coded",
          },
        },
        comparedTo: {
          "@id": "_:control",
          "@type": "ControlCondition",
        },
        hasContext: { "@type": "Context" },
        hasOutcome: { "@type": "Outcome" },
        hasArmData: {
          "@id": "_:obs1",
          "@type": "ObservedResult",
          forCondition: "_:intervention",
          n: 10,
        },
      },
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].intervention.educationThemes).toHaveLength(1);
    expect(result.findings[0].armData).toHaveLength(1);
  });

  test("handles typed numeric values", () => {
    const data = makeData({
      hasFinding: [
        {
          "@type": "Finding",
          sampleSize: {
            "@type": "NumericCodingAnnotation",
            codedValue: { "@type": "xsd:integer", "@value": 667 },
            status: "evrepo:coded",
          },
          evaluates: {
            "@id": "_:intervention",
            "@type": "Intervention",
          },
          comparedTo: {
            "@id": "_:control",
            "@type": "ControlCondition",
          },
          hasContext: { "@type": "Context" },
          hasOutcome: { "@type": "Outcome" },
        },
      ],
    });

    const result = parseInvestigation(data, PREFIXES, LABELS);
    expect(result.findings[0].sampleSize?.value).toBe(667);
  });
});
