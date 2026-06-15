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
  AbstractContentEnhancement,
  BibliographicMetadataEnhancement,
  Community,
  CommunityCopy,
  CommunityFeatures,
  Enhancement,
  LinkedDataEnhancement,
  Reference,
} from "@/types/models";
import type { SearchParams } from "@/services/searchParams";
import type { VocabularyResult } from "@/hooks/useVocabulary";

/** SearchParams with all-undefined filters and no facets — override per test. */
export function makeSearchParams(
  overrides: Partial<SearchParams> = {},
): SearchParams {
  return {
    q: "",
    page: 1,
    startYear: undefined,
    endYear: undefined,
    sort: undefined,
    conceptFilters: [],
    countryCodes: [],
    ...overrides,
  };
}

/**
 * A Community with sane defaults so tests can assert flag-/copy-driven
 * behaviour without depending on the real registry in services/communities.ts.
 * `features` and `copy` merge shallowly so callers override just one field.
 */
export function makeCommunity(
  overrides: Partial<Omit<Community, "features" | "copy">> & {
    features?: Partial<CommunityFeatures>;
    copy?: Partial<CommunityCopy>;
  } = {},
): Community {
  const { features, copy, ...rest } = overrides;
  return {
    slug: "test",
    name: "Test Community",
    defaultAnnotations: [],
    vocabularyUrl: "https://vocab.example/v1",
    contextUrl: "https://vocab.example/ctx",
    filterExcludedSchemes: [],
    pillExcludedSchemes: [],
    geographicSchemes: [],
    exportVariant: "esea",
    features: {
      evidenceMap: false,
      aiSummaries: false,
      selfSignup: false,
      findingsAndEstimates: true,
      exportExcel: true,
      countryFacetFilter: true,
      ...features,
    },
    copy: {
      searchPlaceholder: "Search titles and abstracts",
      drawerTitle: "Refine the evidence",
      countNoun: "results",
      corpusDescriptor: "test research",
      ...copy,
    },
    ...rest,
  };
}

/**
 * A useVocabulary() result, all-null/idle by default — override per test.
 * The one place to extend when VocabularyResult grows a field, so adding a
 * field doesn't ripple to every test that mocks the hook.
 */
export function makeVocabResult(
  overrides: Partial<VocabularyResult> = {},
): VocabularyResult {
  return {
    labels: null,
    broader: null,
    definitions: null,
    inScheme: null,
    schemes: null,
    loading: false,
    error: null,
    ...overrides,
  };
}

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

interface AbstractOpts {
  id?: string;
  text?: string;
  process?: string;
  /** Mirrors Enhancement.created_at (string | null). Defaults to null when omitted. */
  createdAt?: string | null;
  /** Override the source field. Defaults to "openalex". */
  source?: string;
}

/** Build an abstract Enhancement with sensible defaults. */
export function abstractEnh(
  refId: string,
  opts: AbstractOpts = {},
): Enhancement {
  const content: AbstractContentEnhancement = {
    enhancement_type: "abstract",
    process: opts.process ?? "uninverted",
    abstract: opts.text ?? "Default abstract body for fixture.",
  };
  return {
    id: opts.id ?? `${refId}-abs`,
    reference_id: refId,
    source: opts.source ?? "openalex",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: opts.createdAt ?? null,
    content,
  };
}

interface LinkedDataEnhOpts {
  id?: string;
  derivedFrom?: string[] | null;
  createdAt?: string | null;
  investigation?: Record<string, unknown>;
}

/** Build a linked-data Enhancement, optionally wrapping an Investigation dict. */
export function linkedDataEnh(
  refId: string,
  opts: LinkedDataEnhOpts = {},
): Enhancement {
  const content: LinkedDataEnhancement = {
    enhancement_type: "linked_data",
    vocabulary_uri: "https://vocab.example/v1",
    data: {
      "@context": "https://vocab.example/context.jsonld",
      "@type": "LinkedDataEnhancement",
      hasInvestigation: { "@type": "Investigation", ...(opts.investigation ?? {}) },
    },
  };
  return {
    id: opts.id ?? `${refId}-ld`,
    reference_id: refId,
    source: "robot",
    visibility: "public",
    robot_version: "0.1.0",
    derived_from: opts.derivedFrom ?? null,
    created_at: opts.createdAt ?? null,
    content,
  };
}

interface RawEnhOpts {
  id?: string;
  source?: string;
  createdAt?: string | null;
}

/** Build a raw Enhancement (used for ingestor/coder provenance). */
export function rawEnh(refId: string, opts: RawEnhOpts = {}): Enhancement {
  return {
    id: opts.id ?? `${refId}-raw`,
    reference_id: refId,
    source: opts.source ?? "openalex",
    visibility: "public",
    robot_version: null,
    derived_from: null,
    created_at: opts.createdAt ?? null,
    content: {
      enhancement_type: "raw",
    },
  };
}

interface ReferenceOpts {
  id?: string;
  doi?: string;
  bibliographic?: BibOpts;
  /** Abstract text + options. When provided, an abstractEnh is appended. */
  abstract?: string | AbstractOpts;
  /** Investigation dict to wrap in a linked_data enhancement, if any. */
  investigation?: Record<string, unknown>;
  /** Override enhancements entirely (skips bibliographic/abstract/investigation). */
  enhancements?: Enhancement[];
}

/** Build a Reference with optional bibliographic, abstract, and linked-data enhancements. */
export function makeReference(opts: ReferenceOpts = {}): Reference {
  const id = opts.id ?? "abc-123";
  const abstractOpts = typeof opts.abstract === "string"
    ? { text: opts.abstract }
    : opts.abstract;
  const enhancements =
    opts.enhancements ??
    [
      bibliographicEnh(id, opts.bibliographic),
      abstractOpts !== undefined ? abstractEnh(id, abstractOpts) : null,
      opts.investigation
        ? linkedDataEnh(id, { investigation: opts.investigation })
        : null,
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
