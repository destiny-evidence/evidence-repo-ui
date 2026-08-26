/**
 * Row-building logic for the three sheets. Operates on raw JSON
 * structures; field accesses use snake_case to match the wire format.
 */

import {
  extractAbstract,
  extractDoi,
  extractOpenAlexId,
  isDict,
} from "@/services/referenceUtils";
import { expandCompactUri } from "@/services/vocabulary";
import type {
  BibliographicMetadataEnhancement,
  CodingInstitutionConfig,
  Enhancement,
  LinkedDataEnhancement,
  Reference,
} from "@/types/models";

import type {
  ArmRow,
  CellValue,
  CodedAnnotation,
  ConceptResolver,
  Finding,
  Investigation,
  InvestigationRow,
  OutcomeRow,
} from "./types.ts";

export const SHEET_HEADERS = {
  investigation: [
    "reference_id",
    "source",
    "title",
    "abstract",
    "authors",
    "publication_year",
    "doi",
    "openalex_id",
    "documentType",
    "studyDesign",
    "vocabulary",
  ] as const satisfies ReadonlyArray<keyof InvestigationRow>,
  arms: [
    "reference_id",
    "arm_id",
    "intervention_name",
    "intervention_description",
    "control_description",
    "intervention_duration_value",
    "intervention_duration_supportingText",
    "intervention_educationTheme",
    "intervention_educationTheme_supportingText",
    "intervention_implementationFidelity",
    "intervention_implementationFidelity_supportingText",
    "intervention_implementerType",
    "intervention_implementerType_supportingText",
    "sampleSize_value",
    "sampleSize_supportingText",
    "attrition_value",
    "attrition_supportingText",
    "cost_value",
    "context_country",
    "context_countryLevel1",
    "context_educationLevel",
    "context_educationLevel_supportingText",
    "context_participants",
    "context_sampleFeatures",
    "context_sampleFeatures_supportingText",
    "context_setting",
    "context_setting_supportingText",
  ] as const satisfies ReadonlyArray<keyof ArmRow>,
  outcomes: [
    "reference_id",
    "arm_id",
    "outcome_name",
    "outcome_description",
    "outcome_concepts",
    "outcome_concepts_supportingText",
    "effect_metric",
    "point_estimate",
    "ci_lower",
    "ci_upper",
    "standard_error",
    "baseline_adjusted",
    "clustering_adjusted",
    "intervention_n",
    "intervention_mean",
    "intervention_sd",
    "intervention_se",
    "control_n",
    "control_mean",
    "control_sd",
    "control_se",
  ] as const satisfies ReadonlyArray<keyof OutcomeRow>,
};

const ARM_KEY_FIELDS = [
  "evaluates",
  "comparedTo",
  "hasContext",
  "sampleSize",
  "attrition",
  "cost",
] as const;

type PlainRecord = Record<string, unknown>;

// Excel rejects a cell string longer than this, so an over-long abstract would
// otherwise produce a workbook Excel refuses to open.
const EXCEL_CELL_LIMIT = 32767;
const TRUNCATION_NOTICE = "... [truncated by export]";

/**
 * Clamp a cell string to Excel's per-cell limit, replacing the tail with a
 * notice so a reader can tell truncation from a short abstract.
 */
export function truncateForCell(text: string): string {
  if (text.length <= EXCEL_CELL_LIMIT) return text;
  return text.slice(0, EXCEL_CELL_LIMIT - TRUNCATION_NOTICE.length) + TRUNCATION_NOTICE;
}

/** Normalise a JSON-LD value to a list: absent → [], array → itself, single → [value]. */
export function ensureArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Take the first element of an array (any type), else the value itself. */
function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Round numeric cells to 5 decimal places.
 * Pass-through for non-finite numbers and non-numeric values.
 */
function round5Cell(value: CellValue): CellValue {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Math.round(value * 1e5) / 1e5;
}

/**
 * Resolve a CURIE-style concept ID to its vocabulary prefLabel by
 * expanding the CURIE to its full URI (via the JSON-LD @context prefix
 * map) and consulting the URI-keyed label map. Falls back to the raw
 * CURIE when no entry is registered. Pass-through for non-string inputs
 * so callers can use this on values of mixed type.
 */
function label(curie: unknown, vocab: ConceptResolver): unknown {
  if (typeof curie !== "string") return curie;
  const uri = expandCompactUri(curie, vocab.prefixes);
  return vocab.labels.get(uri) ?? curie;
}

/**
 * Return the prefLabel for a concept-coded annotation, or the raw
 * `@id`/`@value` when no prefLabel match is found. Returns null if the
 * annotation is not a structured object.
 */
function codedId(annotation: unknown, vocab: ConceptResolver): CellValue {
  if (!isDict(annotation)) return null;
  const cv = (annotation as CodedAnnotation).codedValue;
  if (isDict(cv)) {
    const conceptId = cv["@id"];
    if (conceptId !== undefined && conceptId !== null) {
      return label(conceptId, vocab) as CellValue;
    }
    return (cv["@value"] ?? null) as CellValue;
  }
  return null;
}

/**
 * Return the `@value` of a numeric/string coding annotation, or null.
 * The value is routed through `round5Cell`, which rounds numerics
 * and passes other types through unchanged.
 */
function codedValue(annotation: unknown): CellValue {
  if (!isDict(annotation)) return null;
  const cv = (annotation as CodedAnnotation).codedValue;
  if (isDict(cv)) return round5Cell((cv["@value"] ?? null) as CellValue);
  return null;
}

/**
 * Return the `supportingText` field of an annotation, or null when the
 * input isn't a structured annotation object.
 */
function supportingText(annotation: unknown): string | null {
  if (isDict(annotation)) {
    const txt = (annotation as CodedAnnotation).supportingText;
    return typeof txt === "string" ? txt : null;
  }
  return null;
}

/**
 * Join the prefLabels of a list of concept-coded annotations with `; `.
 * Nullish and empty entries are dropped so the output is a clean
 * delimiter-separated string.
 */
function joinCodedIds(annotations: unknown, vocab: ConceptResolver): string {
  return ensureArray(annotations)
    .map((a) => codedId(a, vocab))
    .filter((v): v is string | number | boolean => v != null && v !== "")
    .join("; ");
}

/**
 * Join the `@value`s of a list of scalar-coded annotations with `; `,
 * stringifying numerics. Nullish entries are dropped.
 */
function joinCodedValues(annotations: unknown): string {
  return ensureArray(annotations)
    .map((a) => codedValue(a))
    .filter((v): v is string | number | boolean => v != null)
    .map((v) => String(v))
    .join("; ");
}

/**
 * Scalar `@value` cell: a lone value kept typed (numeric stays numeric),
 * two or more `; `-joined so an extra coded value is never dropped.
 */
function collapseCodedValues(annotations: unknown): CellValue {
  const values = ensureArray(annotations)
    .map((a) => codedValue(a))
    .filter((v): v is string | number | boolean => v != null);
  if (values.length <= 1) return values[0] ?? null;
  return values.map((v) => String(v)).join("; ");
}

/**
 * Concatenate the `supportingText` field of each annotation with ` | `
 * between entries.
 */
function joinSupportingTexts(annotations: unknown): string {
  return ensureArray(annotations)
    .map((a) => supportingText(a))
    .filter((v): v is string => v != null && v !== "")
    .join(" | ");
}

/**
 * Return the `@id` of a JSON-LD reference, whether it appears as an inline
 * dict (`{"@id": "_:foo", ...}`) or a bare string ref (`"_:foo"`).
 */
function refId(value: unknown): string | null {
  const v = first(value);
  if (isDict(v)) {
    const id = v["@id"];
    return typeof id === "string" ? id : null;
  }
  if (typeof v === "string") return v;
  return null;
}

/**
 * Index every dict-form blank-node-identified object across the findings
 * so later findings that reference them by string `@id` can be resolved.
 * Keys are blank-node identifiers (e.g. "_:control"); values are the full
 * inline definition.
 */
function buildBlankNodeLookup(findings: Finding[]): Map<string, PlainRecord> {
  const lookup = new Map<string, PlainRecord>();
  for (const finding of findings) {
    for (const key of ["comparedTo", "evaluates", "hasContext", "sampleSize", "attrition", "cost"] as const) {
      for (const value of ensureArray(finding[key])) {
        if (isDict(value)) {
          const id = value["@id"];
          if (typeof id === "string") lookup.set(id, value as PlainRecord);
        }
      }
    }
  }
  return lookup;
}

type Resolver = (value: unknown) => PlainRecord;

/**
 * Build a resolver function that turns either a blank-node reference
 * string or an inline object into the underlying dict, returning an empty
 * object for missing or null values so callers can chain property access
 * without null checks.
 */
function makeResolver(lookup: Map<string, PlainRecord>): Resolver {
  return (value) => {
    const v = first(value);
    if (typeof v === "string") return lookup.get(v) ?? {};
    if (isDict(v)) return v;
    return {};
  };
}

/**
 * Flatten a description that may be either a list of paragraphs or a
 * single string, joining list entries with ` | `.
 */
function flattenDescription(description: unknown): string | null {
  if (Array.isArray(description)) return description.join(" | ");
  if (typeof description === "string") return description;
  return null;
}

/**
 * Build a stable key that identifies a unique arm/context tuple within a
 * single investigation. Used to assign arm IDs and to dedupe rows that
 * share the same configuration but differ only by outcome.
 */
function armKey(finding: Finding, resolve: Resolver): string {
  return ARM_KEY_FIELDS.map((field) => {
    const resolved = resolve(finding[field]);
    const id = resolved["@id"];
    return typeof id === "string" ? id : "";
  }).join(" ");
}

/**
 * Per-investigation, assign 1-based integer IDs to each unique
 * arm/context tuple in encounter order. The returned list is parallel to
 * `findings` so callers can pair `(armId, finding)` by index.
 */
export function assignArmIds(findings: Finding[]): number[] {
  const resolve = makeResolver(buildBlankNodeLookup(findings));
  const seen = new Map<string, number>();
  const out: number[] = [];
  for (const finding of findings) {
    const key = armKey(finding, resolve);
    if (!seen.has(key)) seen.set(key, seen.size + 1);
    out.push(seen.get(key)!);
  }
  return out;
}

/**
 * Collapse rows that are identical across every column, preserving order.
 * Findings within an investigation often share the same arm/context tuple
 * via blank-node references and only differ by outcome (which doesn't
 * appear on the Investigation Arms tab), so flattening produces visually
 * identical rows that add no information.
 */
function dedupeRows<T extends object>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = JSON.stringify(
      Object.keys(row).sort().map((k) => [k, (row as Record<string, unknown>)[k]]),
    );
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Build the single Investigation Details row for one reference. Pulls
 * bibliographic metadata from the latest bibliographic enhancement,
 * external identifiers from the reference, and document/study-design
 * concepts from the linked-data investigation block.
 *
 *`linked` is null for a reference with no coding, in this case only 
 * biblographic info is exported. 
 */
export function buildInvestigationRow(
  reference: Reference,
  bibliographic: BibliographicMetadataEnhancement | null,
  linked: (Enhancement & { content: LinkedDataEnhancement }) | null,
  investigation: Investigation,
  vocab: ConceptResolver,
  codingInstitution?: CodingInstitutionConfig,
): InvestigationRow {
  const authors = bibliographic?.authorship
    ? bibliographic.authorship.map((a) => a.display_name).join("; ")
    : null;
  const abstract = extractAbstract(reference)?.abstract;
  return {
    reference_id: String(reference.id),
    source:
      (linked
        ? codingInstitution?.fromLinkedData(reference, linked)
        : codingInstitution?.fromReference(reference)) ?? null,
    title: bibliographic?.title ?? null,
    abstract: abstract ? truncateForCell(abstract) : null,
    authors: authors || null,
    publication_year: bibliographic?.publication_year ?? null,
    doi: extractDoi(reference.identifiers ?? null),
    openalex_id: extractOpenAlexId(reference.identifiers ?? null),
    documentType: joinCodedIds(ensureArray(investigation.documentType), vocab),
    studyDesign: joinCodedIds(ensureArray(investigation.studyDesign), vocab),
    vocabulary: linked?.content.vocabulary_uri ?? null,
  };
}

/**
 * Build Investigation Arms rows: one per finding, with intervention and
 * control flattened side-by-side. Blank-node references like
 * `"_:control"`, `"_:context"`, or `"_:sampleSize"` reuse the full object
 * defined on a sibling finding, so we resolve them via the shared lookup.
 * Identical rows (same arm/context tuple, no outcome distinguishing them)
 * are deduped before return.
 */
export function buildFindingRows(
  referenceId: string,
  findings: Finding[],
  armIds: number[],
  vocab: ConceptResolver,
): ArmRow[] {
  const resolve = makeResolver(buildBlankNodeLookup(findings));
  const resolveMany = (value: unknown): PlainRecord[] => ensureArray(value).map(resolve);
  const rows: ArmRow[] = [];
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i]!;
    const armId = armIds[i]!;
    const ctx = resolve(finding["hasContext"]);
    const sampleSizes = resolveMany(finding["sampleSize"]);
    const attritions = resolveMany(finding["attrition"]);
    const costs = resolveMany(finding["cost"]);
    const intervention = resolve(finding["evaluates"]);
    const control = resolve(finding["comparedTo"]);
    rows.push({
      reference_id: referenceId,
      arm_id: armId,
      intervention_name: typeof intervention["name"] === "string" ? (intervention["name"] as string) : null,
      intervention_description: flattenDescription(intervention["description"]),
      control_description: flattenDescription(control["description"]),
      intervention_duration_value: collapseCodedValues(intervention["duration"]),
      intervention_duration_supportingText: joinSupportingTexts(intervention["duration"]),
      intervention_educationTheme: joinCodedIds(intervention["educationTheme"], vocab),
      intervention_educationTheme_supportingText: joinSupportingTexts(intervention["educationTheme"]),
      intervention_implementationFidelity: joinCodedIds(ensureArray(intervention["implementationFidelity"]), vocab),
      intervention_implementationFidelity_supportingText: joinSupportingTexts(ensureArray(intervention["implementationFidelity"])),
      intervention_implementerType: joinCodedIds(ensureArray(intervention["implementerType"]), vocab),
      intervention_implementerType_supportingText: joinSupportingTexts(ensureArray(intervention["implementerType"])),
      sampleSize_value: collapseCodedValues(sampleSizes),
      sampleSize_supportingText: joinSupportingTexts(sampleSizes),
      attrition_value: collapseCodedValues(attritions),
      attrition_supportingText: joinSupportingTexts(attritions),
      cost_value: collapseCodedValues(costs),
      context_country: joinCodedValues(ctx["country"]),
      context_countryLevel1: joinCodedValues(ctx["countryLevel1"]),
      context_educationLevel: joinCodedIds(ctx["educationLevel"], vocab),
      context_educationLevel_supportingText: joinSupportingTexts(ctx["educationLevel"]),
      context_participants: joinCodedValues(ctx["participants"]),
      context_sampleFeatures: joinCodedIds(ctx["sampleFeatures"], vocab),
      context_sampleFeatures_supportingText: joinSupportingTexts(ctx["sampleFeatures"]),
      context_setting: joinCodedIds(ctx["setting"], vocab),
      context_setting_supportingText: joinSupportingTexts(ctx["setting"]),
    });
  }
  return dedupeRows(rows);
}

/**
 * Build Outcome rows: one per EffectEstimate, with the parent finding's
 * outcome metadata and the per-condition arm data (n, mean, sd, se)
 * denormalized onto the row. A finding with N effect estimates produces N
 * rows; a finding with outcome or arm data but no effect estimates still
 * produces a single row so that data isn't lost. A finding with no outcome,
 * arm, or effect data produces no rows, so a fully outcomeless reference
 * yields an empty Outcomes tab.
 */
export function buildOutcomeRows(
  referenceId: string,
  findings: Finding[],
  armIds: number[],
  vocab: ConceptResolver,
): OutcomeRow[] {
  const rows: OutcomeRow[] = [];
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i]!;
    const armId = armIds[i]!;
    const outcomeRaw = first(finding["hasOutcome"]);
    const outcomeBlock = isDict(outcomeRaw) ? (outcomeRaw as PlainRecord) : {};
    const outcomeConcepts = joinCodedIds(outcomeBlock["outcome"], vocab);
    const outcomeConceptsSupporting = joinSupportingTexts(outcomeBlock["outcome"]);

    const armData = ensureArray(finding["hasArmData"]).filter(isDict) as PlainRecord[];
    const estimates = ensureArray(finding["hasEffectEstimate"]).filter(isDict) as PlainRecord[];

    const outcomeName =
      typeof outcomeBlock["name"] === "string" ? (outcomeBlock["name"] as string) : null;
    const outcomeDescription =
      typeof outcomeBlock["description"] === "string" ? (outcomeBlock["description"] as string) : null;
    const hasOutcomeContent = Boolean(outcomeName || outcomeDescription || outcomeConcepts !== "");
    if (!hasOutcomeContent && armData.length === 0 && estimates.length === 0) continue;

    const armLookup = new Map<string, PlainRecord>();
    for (const arm of armData) {
      const id = refId(arm["forCondition"]);
      if (id != null) armLookup.set(id, arm);
    }
    const interventionArm = armLookup.get(refId(finding["evaluates"]) ?? "") ?? {};
    const controlArm = armLookup.get(refId(finding["comparedTo"]) ?? "") ?? {};

    // findings with no effect estimate still emit one row (outcome/arm data preserved)
    const effectEstimates = estimates.length ? estimates : [{}];
    for (const effect of effectEstimates) {
      const baselineAdjusted = effect["baselineAdjusted"];
      rows.push({
        reference_id: referenceId,
        arm_id: armId,
        outcome_name: outcomeName,
        outcome_description: outcomeDescription,
        outcome_concepts: outcomeConcepts,
        outcome_concepts_supportingText: outcomeConceptsSupporting,
        effect_metric: label(first(effect["effectSizeMetric"]), vocab) as CellValue,
        point_estimate: round5Cell((effect["pointEstimate"] ?? null) as CellValue),
        ci_lower: round5Cell((effect["confidenceIntervalLower"] ?? null) as CellValue),
        ci_upper: round5Cell((effect["confidenceIntervalUpper"] ?? null) as CellValue),
        standard_error: round5Cell((effect["standardError"] ?? null) as CellValue),
        baseline_adjusted: typeof baselineAdjusted === "boolean" ? baselineAdjusted : null,
        clustering_adjusted: (effect["clusteringAdjusted"] ?? null) as CellValue,
        intervention_n: round5Cell((interventionArm["n"] ?? null) as CellValue),
        intervention_mean: round5Cell((interventionArm["mean"] ?? null) as CellValue),
        intervention_sd: round5Cell((interventionArm["sd"] ?? null) as CellValue),
        intervention_se: round5Cell((interventionArm["se"] ?? null) as CellValue),
        control_n: round5Cell((controlArm["n"] ?? null) as CellValue),
        control_mean: round5Cell((controlArm["mean"] ?? null) as CellValue),
        control_sd: round5Cell((controlArm["sd"] ?? null) as CellValue),
        control_se: round5Cell((controlArm["se"] ?? null) as CellValue),
      });
    }
  }
  return rows;
}
