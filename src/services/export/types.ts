import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";

// JSON-LD structures inside LinkedDataEnhancement.data are kept loose: any
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

/**
 * Bundle of the maps needed to turn a CURIE coded value into a human label:
 * `prefixes` maps a CURIE prefix to its namespace URI (from the JSON-LD
 * @context), `labels` maps a full URI to its SKOS prefLabel (from the
 * vocabulary @graph). Mirrors the (prefixes, labels) pair that
 * `investigationParser` threads through.
 */
export interface ConceptResolver {
  prefixes: Map<string, string>;
  labels: Map<string, string>;
  // URI → scheme URI and the scheme list, used by the reference-level (HPV)
  // workbook to group applied concepts into per-scheme columns. The
  // investigation-hierarchy (esea) workbook doesn't need them.
  inScheme?: Map<string, string>;
  schemes?: ConceptScheme[];
}

// Row types — the column set each sheet writes. Values are the raw
// JS primitives written into cells; `null` is used uniformly for blanks
// so SheetJS produces empty cells.

export type CellValue = string | number | boolean | null;

export interface InvestigationRow {
  reference_id: string;
  source: string | null;
  title: string | null;
  abstract: string | null;
  authors: string | null;
  publication_year: number | null;
  doi: string | null;
  openalex_id: string | null;
  documentType: string;
  studyDesign: string;
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
  intervention_implementationFidelity: string;
  intervention_implementationFidelity_supportingText: string;
  intervention_implementerType: string;
  intervention_implementerType_supportingText: string;
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
