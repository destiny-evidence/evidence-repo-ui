import { describe, test, expect } from "vitest";
import { enrichmentRequestsEnabled } from "@/components/enrichment/enrichmentRequestsEnabled";
import { makeCommunity, makeFinding, makeEffectEstimate } from "../../fixtures";
import type {
  FindingData,
  InvestigationData,
  ResolvedConcept,
} from "@/types/investigation";

const ESEA = makeCommunity({ slug: "esea" });
const HPV = makeCommunity({ slug: "hpv" });

function makeInvestigation(
  overrides: Partial<InvestigationData> = {},
): InvestigationData {
  return {
    documentTypes: [],
    studyDesigns: [],
    isRetracted: false,
    findings: [],
    appliedConcepts: [],
    ...overrides,
  };
}

const concepts = (count: number): ResolvedConcept[] =>
  Array.from({ length: count }, (_, i) => ({
    uri: `u:concept-${i}`,
    label: `Concept ${i}`,
  }));

const annotations = (count: number) =>
  concepts(count).map((value) => ({ value }));

/** A finding that carries estimates */
const estimatedFinding = (overrides: Partial<FindingData> = {}) =>
  makeFinding({ effectEstimates: [makeEffectEstimate()], ...overrides });

describe("enrichmentRequestsEnabled", () => {
  test("is off outside the ESEA community, however sparse the coding", () => {
    expect(enrichmentRequestsEnabled(HPV, makeInvestigation())).toBe(false);
    expect(enrichmentRequestsEnabled(null, makeInvestigation())).toBe(false);
  });

  test("is on for a bibliographic-only ESEA record", () => {
    expect(enrichmentRequestsEnabled(ESEA, null)).toBe(true);
  });

  test("is on for ESEA below the annotation threshold", () => {
    const investigation = makeInvestigation({
      appliedConcepts: concepts(19),
      findings: [estimatedFinding()],
    });

    expect(enrichmentRequestsEnabled(ESEA, investigation)).toBe(true);
  });

  test("is off once ESEA coding reaches the threshold and estimates exist", () => {
    const investigation = makeInvestigation({
      appliedConcepts: concepts(20),
      findings: [estimatedFinding()],
    });

    expect(enrichmentRequestsEnabled(ESEA, investigation)).toBe(false);
  });

  test("is on when any finding lacks effect estimates", () => {
    const investigation = makeInvestigation({
      appliedConcepts: concepts(20),
      findings: [estimatedFinding(), makeFinding({ effectEstimates: [] })],
    });

    expect(enrichmentRequestsEnabled(ESEA, investigation)).toBe(true);
  });

  test("counts annotations nested under findings towards the threshold", () => {
    const investigation = makeInvestigation({
      findings: [
        estimatedFinding({
          intervention: {
            id: "_:int",
            educationThemes: annotations(3),
            implementerTypes: annotations(3),
          },
          context: {
            id: "_:ctx",
            educationLevels: annotations(3),
            participants: [{ value: "Students" }],
          },
          outcome: { outcomes: annotations(3) },
          sampleFeatures: annotations(3),
          sampleSizes: [{ value: 50 }],
          attritions: [{ value: 3 }],
          costs: [{ value: "£1000" }],
          groupDifferences: [{ value: "None reported" }],
        }),
      ],
    });

    expect(enrichmentRequestsEnabled(ESEA, investigation)).toBe(false);
  });
});
