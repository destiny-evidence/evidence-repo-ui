import type {
  ArmData,
  ContextData,
  ControlConditionData,
  EffectEstimateData,
  FindingData,
  InterventionData,
} from "@/types/investigation";
import type { SharedContext } from "@/services/findingGroups";
import type {
  BibliographicMetadataEnhancement,
  Enhancement,
  LinkedDataEnhancement,
  Reference,
} from "@/types/models";

/**
 * Minimal FindingData with all three slots populated and IDs that match.
 * Default shape is enough for most grouping / section / orchestration tests.
 * Override individual fields for richer test cases.
 */
export function makeFinding(overrides: Partial<FindingData> = {}): FindingData {
  return {
    intervention: { id: "_:int", name: "Intervention" },
    interventionRef: "_:int",
    control: { id: "_:ctrl", description: "Control" },
    controlRef: "_:ctrl",
    context: { id: "_:ctx" },
    contextRef: "_:ctx",
    outcome: { name: "Outcome", outcomes: [] },
    ...overrides,
  };
}

/**
 * Rich FindingData with intervention/context/outcome populated for rendering
 * tests. Use this when asserting on labels, tags, descriptions, etc.
 */
export function makeRichFinding(overrides: Partial<FindingData> = {}): FindingData {
  return {
    intervention: {
      id: "_:int",
      name: "Test Intervention",
      educationThemes: [
        { value: { uri: "u:theme", label: "Cooperative Learning" } },
      ],
      descriptions: ["Students work in small groups"],
      duration: { value: 5, supportingText: "5 weeks" },
    },
    interventionRef: "_:int",
    control: { id: "_:ctrl", description: "Business as usual" },
    controlRef: "_:ctrl",
    context: {
      id: "_:ctx",
      educationLevels: [{ value: { uri: "u:1", label: "Primary" } }],
      settings: [{ value: { uri: "u:3", label: "Formal" } }],
    },
    contextRef: "_:ctx",
    outcome: {
      name: "Math test",
      outcomes: [{ value: { uri: "u:2", label: "Basic Skills" } }],
    },
    sampleSize: { value: 50 },
    ...overrides,
  };
}

/** Default effect estimate: positive significant Hedges' g. */
export function makeEffectEstimate(
  overrides: Partial<EffectEstimateData> = {},
): EffectEstimateData {
  return {
    pointEstimate: 0.33,
    standardError: 0.078,
    ciLower: 0.18,
    ciUpper: 0.48,
    effectSizeMetric: { uri: "evrepo:HEDGES_G", label: "Hedges' g" },
    baselineAdjusted: true,
    clusteringAdjusted: "no",
    ...overrides,
  };
}

/** Default arm: bound to the matching makeFinding intervention by default. */
export function makeArm(overrides: Partial<ArmData> = {}): ArmData {
  return {
    id: "_:armI",
    conditionRef: "_:int",
    n: 222,
    ...overrides,
  };
}

/** SharedContext with the same defaults as makeRichFinding's slots. */
export function makeSharedContext(
  overrides: Partial<SharedContext> = {},
): SharedContext {
  return {
    intervention: {
      id: "_:int",
      name: "Cooperative Learning",
      educationThemes: [{ value: { uri: "u:1", label: "Literacy" } }],
      descriptions: ["Students work in small groups"],
      duration: { value: 5 },
    } satisfies InterventionData,
    control: {
      id: "_:ctrl",
      description: "Business as usual",
    } satisfies ControlConditionData,
    context: {
      id: "_:ctx",
      educationLevels: [{ value: { uri: "u:2", label: "Primary" } }],
      settings: [{ value: { uri: "u:3", label: "Formal" } }],
      participants: [{ value: "Students" }],
    } satisfies ContextData,
    ...overrides,
  };
}

interface BibOpts {
  title?: string | null;
  authors?: string[];
  year?: number;
  venue?: string;
}

/** Build a bibliographic Enhancement with sensible defaults. */
export function bibliographicEnh(
  refId: string,
  opts: BibOpts = {},
): Enhancement {
  const content: BibliographicMetadataEnhancement = {
    enhancement_type: "bibliographic",
    authorship:
      opts.authors?.map((display_name, i) => ({
        display_name,
        orcid: null,
        position: i === 0 ? "first" : "last",
      })) ?? null,
    cited_by_count: null,
    created_date: null,
    updated_date: null,
    publication_date: null,
    publication_year: opts.year ?? null,
    publisher: null,
    title: opts.title ?? null,
    pagination: null,
    publication_venue: opts.venue
      ? { display_name: opts.venue, venue_type: "journal" }
      : null,
  };
  return {
    id: `${refId}-bib`,
    reference_id: refId,
    source: "openalex",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: null,
    content,
  };
}

/** Build a linked-data Enhancement wrapping an Investigation dict. */
export function linkedDataEnh(
  refId: string,
  investigation: Record<string, unknown>,
): Enhancement {
  const content: LinkedDataEnhancement = {
    enhancement_type: "linked_data",
    vocabulary_uri: "https://vocab.example/v1",
    data: {
      "@context": "https://vocab.example/context.jsonld",
      "@type": "LinkedDataEnhancement",
      hasInvestigation: { "@type": "Investigation", ...investigation },
    },
  };
  return {
    id: `${refId}-ld`,
    reference_id: refId,
    source: "robot",
    visibility: "public",
    robot_version: "0.1.0",
    derived_from: null,
    created_at: null,
    content,
  };
}

interface ReferenceOpts {
  id?: string;
  doi?: string;
  bibliographic?: BibOpts;
  /** Investigation dict to wrap in a linked_data enhancement, if any. */
  investigation?: Record<string, unknown>;
  /** Override enhancements entirely (skips bibliographic/investigation). */
  enhancements?: Enhancement[];
}

/** Build a Reference with optional bibliographic and linked-data enhancements. */
export function makeReference(opts: ReferenceOpts = {}): Reference {
  const id = opts.id ?? "abc-123";
  const enhancements =
    opts.enhancements ??
    [
      bibliographicEnh(id, opts.bibliographic),
      opts.investigation ? linkedDataEnh(id, opts.investigation) : null,
    ].filter((e): e is Enhancement => e !== null);

  return {
    id,
    visibility: "public",
    identifiers: opts.doi
      ? [{ identifier: opts.doi, identifier_type: "doi" }]
      : null,
    enhancements,
  };
}
