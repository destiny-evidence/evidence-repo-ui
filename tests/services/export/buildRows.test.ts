import { describe, test, expect } from "vitest";

import {
  assignArmIds,
  buildFindingRows,
  buildInvestigationRow,
  buildOutcomeRows,
  latestEnhancementOfType,
} from "@/services/export/build-rows.ts";
import type {
  ConceptResolver,
  Enhancement,
  Finding,
  Reference,
} from "@/services/export/types.ts";

const PREFIXES = new Map([["esea", "https://vocab.esea.education/"]]);

const LABELS = new Map([
  ["https://vocab.esea.education/DocumentTypeScheme/C00008", "Journal Article"],
  ["https://vocab.esea.education/StudyDesignScheme/RCT", "Randomised Controlled Trial"],
  ["https://vocab.esea.education/EducationLevelScheme/Primary", "Primary"],
  ["https://vocab.esea.education/EducationThemeScheme/Literacy", "Literacy"],
  ["https://vocab.esea.education/SettingScheme/Urban", "Urban"],
  ["https://vocab.esea.education/ImplementerScheme/Teacher", "Teacher"],
  ["https://vocab.esea.education/FidelityScheme/High", "High"],
  ["https://vocab.esea.education/EffectMetricScheme/SMD", "Standardised Mean Difference"],
]);

const VOCAB: ConceptResolver = { prefixes: PREFIXES, labels: LABELS };

function bibEnh(overrides: Partial<Enhancement> = {}): Enhancement {
  return {
    id: "bib-1",
    reference_id: "ref-1",
    created_at: "2024-01-01T00:00:00Z",
    content: {
      enhancement_type: "bibliographic",
      title: "Music and literacy",
      authorship: [
        { display_name: "Smith J" },
        { display_name: "Jones K" },
      ],
      publication_year: 2010,
    },
    ...overrides,
  };
}

function linkedEnh(
  investigation: Record<string, unknown>,
  overrides: Partial<Enhancement> = {},
): Enhancement {
  return {
    id: "ld-1",
    reference_id: "ref-1",
    created_at: "2024-01-02T00:00:00Z",
    derived_from: ["raw-1"],
    content: {
      enhancement_type: "linked_data",
      vocabulary_uri: "https://vocab.esea.education/v1",
      data: { hasInvestigation: investigation },
    },
    ...overrides,
  };
}

describe("latestEnhancementOfType", () => {
  test("returns null when no enhancement of that type exists", () => {
    const ref: Reference = { id: "ref-1", enhancements: [bibEnh()] };
    expect(latestEnhancementOfType(ref, "linked_data")).toBeNull();
  });

  test("prefers canonical (reference_id === reference.id) over newer duplicates", () => {
    const canonical = bibEnh({
      id: "bib-canon",
      reference_id: "ref-1",
      created_at: "2024-01-01T00:00:00Z",
    });
    const duplicate = bibEnh({
      id: "bib-dup",
      reference_id: "other-ref",
      created_at: "2025-01-01T00:00:00Z",
    });
    const ref: Reference = {
      id: "ref-1",
      enhancements: [duplicate, canonical],
    };
    expect(latestEnhancementOfType(ref, "bibliographic")?.id).toBe("bib-canon");
  });

  test("within a bucket, picks the enhancement with the latest created_at", () => {
    const older = bibEnh({ id: "bib-old", created_at: "2024-01-01T00:00:00Z" });
    const newer = bibEnh({ id: "bib-new", created_at: "2024-06-01T00:00:00Z" });
    const ref: Reference = { id: "ref-1", enhancements: [older, newer] };
    expect(latestEnhancementOfType(ref, "bibliographic")?.id).toBe("bib-new");
  });

  test("falls back to the duplicate bucket when no canonical exists", () => {
    const dup = bibEnh({
      id: "bib-dup",
      reference_id: "other-ref",
    });
    const ref: Reference = { id: "ref-1", enhancements: [dup] };
    expect(latestEnhancementOfType(ref, "bibliographic")?.id).toBe("bib-dup");
  });
});

describe("assignArmIds", () => {
  test("assigns sequential 1-based IDs in encounter order", () => {
    const findings: Finding[] = [
      { evaluates: { "@id": "_:i1" }, comparedTo: { "@id": "_:c1" } },
      { evaluates: { "@id": "_:i2" }, comparedTo: { "@id": "_:c1" } },
    ];
    expect(assignArmIds(findings)).toEqual([1, 2]);
  });

  test("dedupes findings that share the same arm tuple", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasContext: { "@id": "_:ctx1" },
      },
      // Same arm tuple, different outcome → same arm_id.
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasContext: { "@id": "_:ctx1" },
      },
      // Different context → new arm_id.
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasContext: { "@id": "_:ctx2" },
      },
    ];
    expect(assignArmIds(findings)).toEqual([1, 1, 2]);
  });

  test("resolves blank-node ref strings against sibling findings for arm-key equality", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1", name: "Intervention" },
        comparedTo: { "@id": "_:c1", description: "Control" },
      },
      // Second finding refers to the same intervention by string ref.
      { evaluates: "_:i1", comparedTo: "_:c1" },
    ];
    expect(assignArmIds(findings)).toEqual([1, 1]);
  });
});

describe("buildInvestigationRow", () => {
  test("pulls doi and openalex identifiers, joins authors, and resolves docType", () => {
    const linked = linkedEnh({});
    const bib = bibEnh();
    const ref: Reference = {
      id: "ref-1",
      identifiers: [
        { identifier_type: "doi", identifier: "10.1/abc" },
        { identifier_type: "open_alex", identifier: "W123" },
      ],
      enhancements: [bib, linked],
    };
    const row = buildInvestigationRow(
      ref,
      bib,
      linked,
      {
        documentType: { codedValue: { "@id": "esea:DocumentTypeScheme/C00008" } },
        studyDesign: { codedValue: { "@id": "esea:StudyDesignScheme/RCT" } },
      },
      VOCAB,
    );
    expect(row.reference_id).toBe("ref-1");
    expect(row.doi).toBe("10.1/abc");
    expect(row.openalex_id).toBe("W123");
    expect(row.title).toBe("Music and literacy");
    expect(row.publication_year).toBe(2010);
    expect(row.authors).toBe("Smith J; Jones K");
    expect(row.documentType).toBe("Journal Article");
    expect(row.studyDesign).toBe("Randomised Controlled Trial");
    expect(row.vocabulary).toBe("https://vocab.esea.education/v1");
  });

  test("maps the derived_from upstream raw source to its sponsoring org", () => {
    const cases: Array<[string, string]> = [
      ["eef-eppi-review", "EEF"],
      ["ESSA-something", "ESSA"],
      ["iie-upload", "IIIE"],
      ["random-other-thing", "random-other-thing"],
    ];
    for (const [rawSource, expected] of cases) {
      const raw: Enhancement = {
        id: "raw-1",
        reference_id: "ref-1",
        source: rawSource,
        content: { enhancement_type: "raw" },
      };
      const linked = linkedEnh({});
      const ref: Reference = { id: "ref-1", enhancements: [raw, linked] };
      const row = buildInvestigationRow(ref, null, linked, {}, VOCAB);
      expect(row.source, `source ${rawSource}`).toBe(expected);
    }
  });

  test("source is null when derived_from is empty", () => {
    const linked = linkedEnh({}, { derived_from: null });
    const ref: Reference = { id: "ref-1", enhancements: [linked] };
    const row = buildInvestigationRow(ref, null, linked, {}, VOCAB);
    expect(row.source).toBeNull();
  });
});

describe("buildFindingRows", () => {
  test("resolves blank-node refs against sibling findings", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          name: "Phonics programme",
          description: "Daily phonics instruction",
        },
        comparedTo: {
          "@id": "_:c1",
          description: "Business-as-usual reading instruction",
        },
        hasContext: { "@id": "_:ctx", country: [{ codedValue: { "@value": "USA" } }] },
      },
      // String refs resolve to the same objects.
      { evaluates: "_:i1", comparedTo: "_:c1", hasContext: "_:ctx" },
    ];
    const rows = buildFindingRows("ref-1", findings, [1, 1], VOCAB);
    // Dedup collapses the two identical rows.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.intervention_name).toBe("Phonics programme");
    expect(rows[0]!.intervention_description).toBe("Daily phonics instruction");
    expect(rows[0]!.control_description).toBe(
      "Business-as-usual reading instruction",
    );
    expect(rows[0]!.context_country).toBe("USA");
  });

  test("flattens description arrays with blank-line separators", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          description: ["Paragraph one.", "Paragraph two."],
        },
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_description).toBe(
      "Paragraph one.\n\nParagraph two.",
    );
  });

  test("dedupes identical rows (same arm tuple, no distinguishing outcome)", () => {
    const finding: Finding = {
      evaluates: { "@id": "_:i1", name: "X" },
      comparedTo: { "@id": "_:c1" },
    };
    const rows = buildFindingRows("ref-1", [finding, finding], [1, 1], VOCAB);
    expect(rows).toHaveLength(1);
  });

  test("joins concept-coded education themes with `; ` and prefLabels", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          educationTheme: [
            { codedValue: { "@id": "esea:EducationThemeScheme/Literacy" } },
            { codedValue: { "@id": "esea:UnknownScheme/X" } },
          ],
        },
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    // Known concept resolves to label, unknown falls back to CURIE.
    expect(rows[0]!.intervention_educationTheme).toBe(
      "Literacy; esea:UnknownScheme/X",
    );
  });
});

describe("buildOutcomeRows", () => {
  test("emits one row per effect estimate", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasOutcome: { name: "Reading score" },
        hasEffectEstimate: [
          {
            effectSizeMetric: "esea:EffectMetricScheme/SMD",
            pointEstimate: 0.123456789,
            confidenceIntervalLower: 0.05,
            confidenceIntervalUpper: 0.2,
            standardError: 0.04,
            baselineAdjusted: true,
          },
          {
            effectSizeMetric: "esea:EffectMetricScheme/SMD",
            pointEstimate: 0.3,
          },
        ],
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.effect_metric).toBe("Standardised Mean Difference");
    // round5: 0.123456789 → 0.12346
    expect(rows[0]!.point_estimate).toBeCloseTo(0.12346, 10);
    expect(rows[0]!.baseline_adjusted).toBe(true);
    expect(rows[1]!.point_estimate).toBe(0.3);
    expect(rows[1]!.baseline_adjusted).toBeNull();
  });

  test("emits a single row when there are no effect estimates", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasOutcome: { name: "Reading score" },
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome_name).toBe("Reading score");
    expect(rows[0]!.point_estimate).toBeNull();
  });

  test("resolves intervention and control arm data via forCondition", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasOutcome: { name: "Reading" },
        hasArmData: [
          { forCondition: "_:i1", n: 100, mean: 12.3456789, sd: 2.1, se: 0.21 },
          { forCondition: "_:c1", n: 95, mean: 10.0, sd: 2.5 },
        ],
        hasEffectEstimate: [{ pointEstimate: 0.5 }],
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_n).toBe(100);
    // round5: 12.3456789 → 12.34568
    expect(rows[0]!.intervention_mean).toBeCloseTo(12.34568, 10);
    expect(rows[0]!.intervention_sd).toBe(2.1);
    expect(rows[0]!.intervention_se).toBe(0.21);
    expect(rows[0]!.control_n).toBe(95);
    expect(rows[0]!.control_mean).toBe(10);
    expect(rows[0]!.control_sd).toBe(2.5);
    expect(rows[0]!.control_se).toBeNull();
  });

  test("resolves forCondition objects with @id as well as bare ref strings", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasArmData: [
          { forCondition: { "@id": "_:i1" }, n: 50 },
          { forCondition: { "@id": "_:c1" }, n: 48 },
        ],
        hasEffectEstimate: [{ pointEstimate: 0.1 }],
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_n).toBe(50);
    expect(rows[0]!.control_n).toBe(48);
  });
});
