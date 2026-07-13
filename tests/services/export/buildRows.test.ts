import { describe, test, expect } from "vitest";

import {
  assignArmIds,
  buildFindingRows,
  buildInvestigationRow,
  buildOutcomeRows,
} from "@/services/export/buildRows.ts";
import { rawSourcePatterns } from "@/services/codingInstitution";
import type {
  ConceptResolver,
  Finding,
} from "@/services/export/types.ts";
import type {
  BibliographicMetadataEnhancement,
  Enhancement,
  EnhancementContent,
  LinkedDataEnhancement,
  Reference,
} from "@/types/models";

/**
 * Pad a Reference with the required-but-nullable fields the model has
 * but the tests don't care about. `overrides` wins.
 */
function makeRef(overrides: Partial<Reference>): Reference {
  return {
    id: "ref-1",
    visibility: "public",
    identifiers: null,
    enhancements: null,
    ...overrides,
  };
}

/**
 * Pad an Enhancement with the required-but-nullable wrapper fields the
 * model has but the tests don't care about. `overrides` wins; pass
 * `content` to specify the discriminated payload.
 */
function makeEnh(
  content: EnhancementContent,
  overrides: Partial<Enhancement> = {},
): Enhancement {
  return {
    id: "enh-1",
    reference_id: "ref-1",
    source: "test",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: "2024-01-01T00:00:00Z",
    content,
    ...overrides,
  };
}

/**
 * Pad a BibliographicMetadataEnhancement content with the
 * required-but-nullable fields the tests don't care about. Provides
 * sensible defaults for the bits the row builder reads.
 */
function makeBibContent(
  overrides: Partial<BibliographicMetadataEnhancement> = {},
): BibliographicMetadataEnhancement {
  return {
    enhancement_type: "bibliographic",
    title: "Music and literacy",
    authorship: [
      { display_name: "Smith J", orcid: null, position: "first" },
      { display_name: "Jones K", orcid: null, position: "middle" },
    ],
    publication_year: 2010,
    cited_by_count: null,
    created_date: null,
    updated_date: null,
    publication_date: null,
    publisher: null,
    pagination: null,
    publication_venue: null,
    ...overrides,
  };
}

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
  ["https://vocab.esea.education/StudyDesignScheme/QED", "Quasi-Experimental Design"],
  ["https://vocab.esea.education/ImplementerScheme/NGO", "NGO"],
  ["https://vocab.esea.education/ImplementationFidelityScheme/High", "High Fidelity"],
  ["https://vocab.esea.education/ImplementationFidelityScheme/Partial", "Partial Fidelity"],
]);

const VOCAB: ConceptResolver = { prefixes: PREFIXES, labels: LABELS };

function bibEnh(
  overrides: Partial<Enhancement> = {},
): Enhancement & { content: BibliographicMetadataEnhancement } {
  return {
    ...makeEnh(makeBibContent(), { id: "bib-1" }),
    ...overrides,
    content: makeBibContent(),
  };
}

function linkedEnh(
  investigation: Record<string, unknown>,
  overrides: Partial<Enhancement> = {},
): Enhancement & { content: LinkedDataEnhancement } {
  const content: LinkedDataEnhancement = {
    enhancement_type: "linked_data",
    vocabulary_uri: "https://vocab.esea.education/v1",
    data: { hasInvestigation: investigation },
  };
  return {
    ...makeEnh(content, {
      id: "ld-1",
      created_at: "2024-01-02T00:00:00Z",
      derived_from: ["raw-1"],
    }),
    ...overrides,
    content,
  };
}

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
    const ref = makeRef({
      identifiers: [
        { identifier: "10.1/abc", identifier_type: "doi" },
        { identifier: "W123", identifier_type: "open_alex" },
      ],
      enhancements: [bib, linked],
    });
    const row = buildInvestigationRow(
      ref,
      bib.content,
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

  // Resolver behaviour and edge cases live in
  // tests/services/codingInstitution.test.ts; here we just check the plumbing
  // into row.source — populated with a config, null without one.
  test("source reflects the coding-institution config (null when absent)", () => {
    const raw = makeEnh(
      { enhancement_type: "raw" },
      { id: "raw-1", source: "eef-eppi-review" },
    );
    const linked = linkedEnh({});
    const ref = makeRef({ enhancements: [raw, linked] });
    const coding = rawSourcePatterns([[/(^|[^a-z])eef([^a-z]|$)/, "EEF"]]);

    expect(buildInvestigationRow(ref, null, linked, {}, VOCAB, coding).source).toBe("EEF");
    expect(buildInvestigationRow(ref, null, linked, {}, VOCAB).source).toBeNull();
  });

  test("joins multiple study designs; single document type unchanged", () => {
    const linked = linkedEnh({});
    const bib = bibEnh();
    const ref = makeRef({ enhancements: [bib, linked] });
    const row = buildInvestigationRow(
      ref,
      bib.content,
      linked,
      {
        documentType: { codedValue: { "@id": "esea:DocumentTypeScheme/C00008" } },
        studyDesign: [
          { codedValue: { "@id": "esea:StudyDesignScheme/RCT" } },
          { codedValue: { "@id": "esea:StudyDesignScheme/QED" } },
        ],
      },
      VOCAB,
    );
    expect(row.documentType).toBe("Journal Article");
    expect(row.studyDesign).toBe(
      "Randomised Controlled Trial; Quasi-Experimental Design",
    );
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

  test("joins description arrays with ' | ' separators", () => {
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
      "Paragraph one. | Paragraph two.",
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

  test("joins multiple implementer types and fidelity, with their supporting text", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          implementerType: [
            { codedValue: { "@id": "esea:ImplementerScheme/Teacher" }, supportingText: "p. 1" },
            { codedValue: { "@id": "esea:ImplementerScheme/NGO" }, supportingText: "p. 2" },
          ],
          implementationFidelity: [
            { codedValue: { "@id": "esea:ImplementationFidelityScheme/High" }, supportingText: "p. 4" },
            { codedValue: { "@id": "esea:ImplementationFidelityScheme/Partial" }, supportingText: "p. 5" },
          ],
        },
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_implementerType).toBe("Teacher; NGO");
    expect(rows[0]!.intervention_implementerType_supportingText).toBe("p. 1 | p. 2");
    // implementationFidelity is a separate read/type, so pin it too.
    expect(rows[0]!.intervention_implementationFidelity).toBe("High Fidelity; Partial Fidelity");
    expect(rows[0]!.intervention_implementationFidelity_supportingText).toBe("p. 4 | p. 5");
  });

  test("tolerates a single dict (not array) for multi-valued concept and value columns", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          // no @set upstream → a single value compacts to a bare dict, not [dict]
          educationTheme: { codedValue: { "@id": "esea:EducationThemeScheme/Literacy" } },
        },
        hasContext: {
          "@id": "_:ctx",
          country: { codedValue: { "@value": "USA" } },
          educationLevel: {
            codedValue: { "@id": "esea:EducationLevelScheme/Primary" },
            supportingText: "p. 3",
          },
        },
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_educationTheme).toBe("Literacy");
    expect(rows[0]!.context_country).toBe("USA");
    expect(rows[0]!.context_educationLevel).toBe("Primary");
    expect(rows[0]!.context_educationLevel_supportingText).toBe("p. 3");
  });

  test("resolves structural refs wrapped in single-element arrays (@set shape)", () => {
    const findings: Finding[] = [
      {
        evaluates: [{ "@id": "_:i1", name: "Wrapped intervention" }],
        comparedTo: [{ "@id": "_:c1", name: "Control" }],
        hasArmData: [
          { forCondition: ["_:i1"], n: 100 },
          { forCondition: ["_:c1"], n: 95 },
        ],
        hasEffectEstimate: [{ pointEstimate: 0.5 }],
      },
      // later finding reuses the array-defined intervention/control by bare ref
      { evaluates: "_:i1", comparedTo: "_:c1" },
    ];
    // Drive arm IDs through the real assignArmIds path (not a hardcoded [1, 2]),
    // which production calls before row-building and which depends on the same
    // makeResolver/buildBlankNodeLookup/refId helpers this task changes. Both
    // findings share one arm tuple, so the real flow dedupes to a single row.
    const armIds = assignArmIds(findings);
    expect(armIds).toEqual([1, 1]);
    const armRows = buildFindingRows("ref-1", findings, armIds, VOCAB);
    expect(armRows).toHaveLength(1);
    expect(armRows[0]!.intervention_name).toBe("Wrapped intervention");
    const outRows = buildOutcomeRows("ref-1", findings, armIds, VOCAB);
    expect(outRows[0]!.intervention_n).toBe(100);
    expect(outRows[0]!.control_n).toBe(95);
  });

  test("joins multiple sampleSize/attrition/cost values instead of dropping extras", () => {
    const findings: Finding[] = [
      {
        sampleSize: [
          { codedValue: { "@value": 100 }, supportingText: "arm A" },
          { codedValue: { "@value": 120 }, supportingText: "arm B" },
        ],
        attrition: [{ codedValue: { "@value": 5 } }, { codedValue: { "@value": 8 } }],
        cost: [{ codedValue: { "@value": 1000 } }, { codedValue: { "@value": 2000 } }],
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.sampleSize_value).toBe("100; 120");
    expect(rows[0]!.sampleSize_supportingText).toBe("arm A | arm B");
    expect(rows[0]!.attrition_value).toBe("5; 8");
    expect(rows[0]!.cost_value).toBe("1000; 2000");
  });

  test("resolves and joins sampleSize given as multiple blank-node refs", () => {
    const findings: Finding[] = [
      {
        sampleSize: [
          { "@id": "_:ss1", codedValue: { "@value": 100 } },
          { "@id": "_:ss2", codedValue: { "@value": 120 } },
        ],
      },
      // later finding reaches the same nodes by bare ref (the common real-data shape)
      { sampleSize: ["_:ss1", "_:ss2"] },
    ];
    const rows = buildFindingRows("ref-1", findings, [1, 2], VOCAB);
    expect(rows[1]!.sampleSize_value).toBe("100; 120");
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

  test("emits no rows for a finding with no outcome, arm, or effect data", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows).toEqual([]);
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

  test("resolves effect metric and duration wrapped in an array (@set shape)", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1", duration: [{ codedValue: { "@value": 40 } }] },
        hasEffectEstimate: [
          { effectSizeMetric: ["esea:EffectMetricScheme/SMD"], pointEstimate: 0.2 },
        ],
      },
    ];
    const armRows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(armRows[0]!.intervention_duration_value).toBe(40);
    const outRows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(outRows[0]!.effect_metric).toBe("Standardised Mean Difference");
  });

  test("joins multiple durations rather than dropping all but the first", () => {
    const findings: Finding[] = [
      {
        evaluates: {
          "@id": "_:i1",
          duration: [
            { codedValue: { "@value": 5 }, supportingText: "5 weeks" },
            { codedValue: { "@value": 10 }, supportingText: "10 weeks" },
          ],
        },
      },
    ];
    const rows = buildFindingRows("ref-1", findings, [1], VOCAB);
    expect(rows[0]!.intervention_duration_value).toBe("5; 10");
    expect(rows[0]!.intervention_duration_supportingText).toBe("5 weeks | 10 weeks");
  });

  test("tolerates single-dict hasArmData/hasEffectEstimate and array-wrapped hasOutcome (@set shape)", () => {
    const findings: Finding[] = [
      {
        evaluates: { "@id": "_:i1" },
        comparedTo: { "@id": "_:c1" },
        hasOutcome: [{ name: "Reading" }],            // array wrap of a singular block → first
        hasArmData: { forCondition: "_:i1", n: 100 }, // single dict of a repeatable container → all
        hasEffectEstimate: { pointEstimate: 0.5 },    // single dict of a repeatable container → all
      },
    ];
    const rows = buildOutcomeRows("ref-1", findings, [1], VOCAB);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome_name).toBe("Reading");
    expect(rows[0]!.point_estimate).toBe(0.5);
    expect(rows[0]!.intervention_n).toBe(100);
  });
});
