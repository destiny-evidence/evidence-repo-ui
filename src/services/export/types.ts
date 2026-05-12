/**
 * Shared types for the SheetJS export pipeline.
 *
 * The Reference / Enhancement shapes mirror the wire format of the
 * destiny-sdk JSON used by the Python reference implementation
 * (snake_case fields straight off the API). JSON-LD investigation
 * structures are highly variant — blank-node refs, optional fields,
 * mixed scalar/concept annotations — so they are intentionally typed
 * loosely with `Record<string, unknown>` and narrowed by helpers in
 * `build-rows.ts`. The row types are strict because consumers will
 * write them straight into worksheet columns.
 */

export type EnhancementType =
  | "linked_data"
  | "bibliographic"
  | "abstract"
  | "raw"
  | "annotation"
  | (string & {});

export interface Identifier {
  identifier_type: string;
  identifier: string;
}

export interface Authorship {
  display_name: string;
  orcid?: string | null;
  position?: string;
}

export interface BibliographicContent {
  enhancement_type: "bibliographic";
  title?: string;
  authorship?: Authorship[] | null;
  publication_year?: number;
  [key: string]: unknown;
}

export interface LinkedDataContent {
  enhancement_type: "linked_data";
  vocabulary_uri: string;
  data: LinkedData;
}

export interface LinkedData {
  "@context"?: string;
  "@type"?: string;
  hasInvestigation?: Investigation;
  [key: string]: unknown;
}

export interface GenericEnhancementContent {
  enhancement_type: EnhancementType;
  [key: string]: unknown;
}

export type EnhancementContent =
  | BibliographicContent
  | LinkedDataContent
  | GenericEnhancementContent;

export interface Enhancement {
  id?: string;
  reference_id?: string;
  source?: string;
  derived_from?: string[] | null;
  created_at?: string;
  content: EnhancementContent;
}

export interface Reference {
  id: string;
  identifiers?: Identifier[] | null;
  enhancements?: Enhancement[] | null;
}

// JSON-LD structures inside LinkedDataContent.data are kept loose: any
// node can be either an inline object or a blank-node ref string, and
// most fields are optional. We treat them as Record<string, unknown>
// and let the row builders narrow defensively.
export type Investigation = Record<string, unknown>;
export type Finding = Record<string, unknown>;

// Concept-coded vs. scalar-coded annotations both live under a single
// JSON shape: `{ codedValue: { "@id"?: string, "@value"?: ... } }` with
// an optional `supportingText`.
export interface CodedAnnotation {
  codedValue?: { "@id"?: string; "@value"?: unknown };
  supportingText?: string;
  [key: string]: unknown;
}

/** Map of vocabulary CURIE (e.g. `esea:DocumentTypeScheme/C00008`) to prefLabel. */
export type LabelLookup = Map<string, string>;

// Row types — the column set each sheet writes. Values are the raw
// JS primitives written into cells; `null` is used uniformly for blanks
// so SheetJS produces empty cells.

export type CellValue = string | number | boolean | null;

export interface InvestigationRow {
  reference_id: string;
  source: string | null;
  title: string | null;
  authors: string | null;
  publication_year: number | null;
  doi: string | null;
  openalex_id: string | null;
  documentType: CellValue;
  studyDesign: CellValue;
  vocabulary: string;
}

export interface ArmRow {
  reference_id: string;
  arm_id: number;
  intervention_name: string | null;
  intervention_description: string | null;
  control_description: string | null;
  intervention_duration_value: CellValue;
  intervention_duration_supportingText: string | null;
  intervention_educationTheme: string;
  intervention_educationTheme_supportingText: string;
  intervention_implementationFidelity: CellValue;
  intervention_implementationFidelity_supportingText: string | null;
  intervention_implementerType: CellValue;
  intervention_implementerType_supportingText: string | null;
  sampleSize_value: CellValue;
  sampleSize_supportingText: string | null;
  attrition_value: CellValue;
  attrition_supportingText: string | null;
  cost_value: CellValue;
  context_country: string;
  context_countryLevel1: string;
  context_educationLevel: string;
  context_educationLevel_supportingText: string;
  context_participants: string;
  context_sampleFeatures: string;
  context_sampleFeatures_supportingText: string;
  context_setting: string;
  context_setting_supportingText: string;
}

export interface OutcomeRow {
  reference_id: string;
  arm_id: number;
  outcome_name: string | null;
  outcome_description: string | null;
  outcome_concepts: string;
  outcome_concepts_supportingText: string;
  effect_metric: CellValue;
  point_estimate: CellValue;
  ci_lower: CellValue;
  ci_upper: CellValue;
  standard_error: CellValue;
  baseline_adjusted: boolean | null;
  clustering_adjusted: CellValue;
  intervention_n: CellValue;
  intervention_mean: CellValue;
  intervention_sd: CellValue;
  intervention_se: CellValue;
  control_n: CellValue;
  control_mean: CellValue;
  control_sd: CellValue;
  control_se: CellValue;
}

export interface BuiltRows {
  investigation: InvestigationRow[];
  arms: ArmRow[];
  outcomes: OutcomeRow[];
}
