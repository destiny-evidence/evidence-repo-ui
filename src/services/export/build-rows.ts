/**
 * Row-building logic for the three sheets — port of the same-named helpers in
 * generate_example_combined_results_effects.py. Operates on raw JSON
 * structures (no pydantic equivalent on the JS side); field accesses use
 * snake_case to match the wire format.
 */

import { expandCompactUri } from "@/services/vocabulary";

import type {
  ArmRow,
  BibliographicContent,
  CellValue,
  CodedAnnotation,
  ConceptResolver,
  Enhancement,
  EnhancementType,
  Finding,
  Investigation,
  InvestigationRow,
  LinkedDataContent,
  OutcomeRow,
  Reference,
} from "./types.ts";

export const SHEET_HEADERS = {
  investigation: [
    "reference_id",
    "source",
    "title",
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

/**
 * True for non-null, non-array objects. Excludes arrays so callers can
 * distinguish "structured annotation" from "list of annotations".
 */
function isPlainObject(v: unknown): v is PlainRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Round numeric cells to 5 decimal places. The Python writer's %.16g
 * serialization disagrees with a native JS round-trip on the last digit
 * or two, and no field here (effect sizes, means, SDs, n) needs more
 * precision than that. The Python script applies the same rounding so the
 * two outputs match byte-for-byte. Pass-through for non-finite numbers
 * and non-numeric values.
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
  if (!isPlainObject(annotation)) return null;
  const cv = (annotation as CodedAnnotation).codedValue;
  if (isPlainObject(cv)) {
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
 * Numeric values pass through `round5` so the result matches the Python
 * port's rounding behaviour.
 */
function codedValue(annotation: unknown): CellValue {
  if (!isPlainObject(annotation)) return null;
  const cv = (annotation as CodedAnnotation).codedValue;
  if (isPlainObject(cv)) return round5Cell((cv["@value"] ?? null) as CellValue);
  return null;
}

/**
 * Return the `supportingText` field of an annotation, or null when the
 * input isn't a structured annotation object.
 */
function supportingText(annotation: unknown): string | null {
  if (isPlainObject(annotation)) {
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
  const list = Array.isArray(annotations) ? annotations : [];
  return list
    .map((a) => codedId(a, vocab))
    .filter((v): v is string | number | boolean => v != null && v !== "")
    .join("; ");
}

/**
 * Join the `@value`s of a list of scalar-coded annotations with `; `,
 * stringifying numerics. Nullish entries are dropped.
 */
function joinCodedValues(annotations: unknown): string {
  const list = Array.isArray(annotations) ? annotations : [];
  return list
    .map((a) => codedValue(a))
    .filter((v): v is string | number | boolean => v != null)
    .map((v) => String(v))
    .join("; ");
}

/**
 * Concatenate the `supportingText` field of each annotation with a blank
 * line between entries. Mirrors the Python writer so wrapped cells render
 * identically in Excel.
 */
function joinSupportingTexts(annotations: unknown): string {
  const list = Array.isArray(annotations) ? annotations : [];
  return list
    .map((a) => supportingText(a))
    .filter((v): v is string => v != null && v !== "")
    .join("\n\n");
}

/**
 * Return the `@id` of a JSON-LD reference, whether it appears as an inline
 * dict (`{"@id": "_:foo", ...}`) or a bare string ref (`"_:foo"`).
 */
function refId(value: unknown): string | null {
  if (isPlainObject(value)) {
    const id = value["@id"];
    return typeof id === "string" ? id : null;
  }
  if (typeof value === "string") return value;
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
      const value = finding[key];
      if (isPlainObject(value)) {
        const id = value["@id"];
        if (typeof id === "string") lookup.set(id, value);
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
    if (typeof value === "string") return lookup.get(value) ?? {};
    if (isPlainObject(value)) return value;
    return {};
  };
}

/**
 * Flatten a description that may be either a list of paragraphs or a
 * single string, joining list entries with blank lines.
 */
function flattenDescription(description: unknown): string | null {
  if (Array.isArray(description)) return description.join("\n\n");
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
 * Map an upstream-enhancement source string to its sponsoring
 * organization (EEF / IIIE / ESSA), falling back to the raw source so
 * unrecognized values stay visible in the export.
 */
function mapSource(rawSource: string | undefined | null): string | null {
  if (!rawSource) return null;
  const lowered = rawSource.toLowerCase();
  if (lowered.includes("eef")) return "EEF";
  if (lowered.includes("essa")) return "ESSA";
  if (lowered.includes("iie")) return "IIIE";
  return rawSource;
}

/**
 * Resolve the human-readable source for a linked-data enhancement by
 * following its `derived_from` chain to the upstream raw enhancement on
 * the same reference, then mapping that source to its sponsoring
 * organization.
 */
function derivedSource(reference: Reference, linkedEnhancement: Enhancement | null): string | null {
  if (!linkedEnhancement) return null;
  const byId = new Map<string, Enhancement>();
  for (const e of reference.enhancements ?? []) {
    if (e.id) byId.set(e.id, e);
  }
  for (const upstreamId of linkedEnhancement.derived_from ?? []) {
    const upstream = byId.get(upstreamId);
    if (upstream) return mapSource(upstream.source);
  }
  return null;
}

/**
 * Return the highest-priority enhancement of the given type, or null.
 *
 * Priority: canonical-reference enhancements first, then most recent by
 * `created_at`. Search-result references carry enhancements from the
 * canonical reference (`enhancement.reference_id === reference.id`)
 * alongside any deduplicated duplicates; canonical data wins even when a
 * duplicate is newer. Falls back to the most recent duplicate enhancement
 * when the canonical bucket has none of this type.
 */
export function latestEnhancementOfType(
  reference: Reference,
  enhancementType: EnhancementType,
): Enhancement | null {
  const canonical: Enhancement[] = [];
  const duplicate: Enhancement[] = [];
  for (const e of reference.enhancements ?? []) {
    if (e?.content?.enhancement_type !== enhancementType) continue;
    if (e.reference_id === reference.id) canonical.push(e);
    else duplicate.push(e);
  }
  const bucket = canonical.length ? canonical : duplicate;
  if (bucket.length === 0) return null;
  // created_at is an ISO-8601 timestamp; lexical sort matches chronological.
  return bucket.reduce((best, e) =>
    (e.created_at ?? "") > (best.created_at ?? "") ? e : best,
  );
}

/**
 * Build the single Investigation Details row for one reference. Pulls
 * bibliographic metadata from the latest bibliographic enhancement,
 * external identifiers from the reference, and document/study-design
 * concepts from the linked-data investigation block.
 */
export function buildInvestigationRow(
  reference: Reference,
  bibliographic: Enhancement | null,
  linked: Enhancement,
  investigation: Investigation,
  vocab: ConceptResolver,
): InvestigationRow {
  const docType = investigation.documentType ?? {};
  const bibContent =
    bibliographic && bibliographic.content.enhancement_type === "bibliographic"
      ? (bibliographic.content as BibliographicContent)
      : null;
  const authors = bibContent?.authorship
    ? bibContent.authorship.map((a) => a.display_name).join("; ")
    : null;
  const identifiersByType: Record<string, string> = {};
  for (const i of reference.identifiers ?? []) {
    identifiersByType[i.identifier_type] = i.identifier;
  }
  const linkedContent = linked.content as LinkedDataContent;
  return {
    reference_id: String(reference.id),
    source: derivedSource(reference, linked),
    title: bibContent?.title ?? null,
    authors: authors || null,
    publication_year: bibContent?.publication_year ?? null,
    doi: identifiersByType["doi"] ?? null,
    openalex_id: identifiersByType["open_alex"] ?? null,
    documentType: codedId(docType, vocab),
    studyDesign: codedId(investigation.studyDesign ?? {}, vocab),
    vocabulary: String(linkedContent.vocabulary_uri),
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
  const rows: ArmRow[] = [];
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i]!;
    const armId = armIds[i]!;
    const ctx = resolve(finding["hasContext"]);
    const sampleSize = resolve(finding["sampleSize"]);
    const attrition = resolve(finding["attrition"]);
    const cost = resolve(finding["cost"]);
    const intervention = resolve(finding["evaluates"]);
    const control = resolve(finding["comparedTo"]);
    rows.push({
      reference_id: referenceId,
      arm_id: armId,
      intervention_name: typeof intervention["name"] === "string" ? (intervention["name"] as string) : null,
      intervention_description: flattenDescription(intervention["description"]),
      control_description: flattenDescription(control["description"]),
      intervention_duration_value: codedValue(intervention["duration"]),
      intervention_duration_supportingText: supportingText(intervention["duration"]),
      intervention_educationTheme: joinCodedIds(intervention["educationTheme"], vocab),
      intervention_educationTheme_supportingText: joinSupportingTexts(intervention["educationTheme"]),
      intervention_implementationFidelity: codedId(intervention["implementationFidelity"], vocab),
      intervention_implementationFidelity_supportingText: supportingText(intervention["implementationFidelity"]),
      intervention_implementerType: codedId(intervention["implementerType"], vocab),
      intervention_implementerType_supportingText: supportingText(intervention["implementerType"]),
      sampleSize_value: codedValue(sampleSize),
      sampleSize_supportingText: supportingText(sampleSize),
      attrition_value: codedValue(attrition),
      attrition_supportingText: supportingText(attrition),
      cost_value: codedValue(cost),
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
 * rows; findings without any effect estimates still produce a single row
 * so the outcome and arm data aren't lost.
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
    const outcomeBlock = isPlainObject(finding["hasOutcome"]) ? (finding["hasOutcome"] as PlainRecord) : {};
    const outcomeConcepts = joinCodedIds(outcomeBlock["outcome"], vocab);
    const outcomeConceptsSupporting = joinSupportingTexts(outcomeBlock["outcome"]);

    const armData = Array.isArray(finding["hasArmData"]) ? (finding["hasArmData"] as PlainRecord[]) : [];
    const armLookup = new Map<string, PlainRecord>();
    for (const arm of armData) {
      const id = refId(arm["forCondition"]);
      if (id != null) armLookup.set(id, arm);
    }
    const interventionArm = armLookup.get(refId(finding["evaluates"]) ?? "") ?? {};
    const controlArm = armLookup.get(refId(finding["comparedTo"]) ?? "") ?? {};

    const effectEstimates = Array.isArray(finding["hasEffectEstimate"])
      ? (finding["hasEffectEstimate"] as PlainRecord[])
      : [{}];
    for (const effect of effectEstimates) {
      const baselineAdjusted = effect["baselineAdjusted"];
      rows.push({
        reference_id: referenceId,
        arm_id: armId,
        outcome_name: typeof outcomeBlock["name"] === "string" ? (outcomeBlock["name"] as string) : null,
        outcome_description: typeof outcomeBlock["description"] === "string" ? (outcomeBlock["description"] as string) : null,
        outcome_concepts: outcomeConcepts,
        outcome_concepts_supportingText: outcomeConceptsSupporting,
        effect_metric: label(effect["effectSizeMetric"], vocab) as CellValue,
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
