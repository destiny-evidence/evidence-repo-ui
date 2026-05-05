import { expandCompactUri } from "./vocabulary/contextService";
import type {
  InvestigationData,
  CodedAnnotation,
  ResolvedConcept,
  StringAnnotation,
  NumericAnnotation,
  InterventionData,
  ControlConditionData,
  ContextData,
  OutcomeData,
  FindingData,
  EffectEstimateData,
  ArmData,
} from "@/types/investigation";

type Dict = Record<string, unknown>;

const SKIP_STATUSES = ["notReported", "notApplicable"];

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ensureArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function shouldSkip(node: Dict, prefixes: Map<string, string>): boolean {
  const status = node["status"];
  if (typeof status !== "string") return false;
  const expanded = expandCompactUri(status, prefixes);
  const local = expanded.split(/[/#]/).pop() ?? expanded;
  return SKIP_STATUSES.includes(local);
}

function getSupportingText(node: Dict): string | undefined {
  return typeof node["supportingText"] === "string"
    ? node["supportingText"]
    : undefined;
}

function getString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function resolveNumericValue(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (isDict(v) && "@value" in v) {
    const val = v["@value"];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = Number(val);
      return Number.isNaN(n) ? undefined : n;
    }
  }
  return undefined;
}

function resolveStringValue(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (isDict(v) && "@value" in v) {
    const val = v["@value"];
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}

function resolveConceptAnnotation(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): CodedAnnotation<ResolvedConcept> | null {
  if (shouldSkip(node, prefixes)) return null;
  const codedValue = node["codedValue"];
  if (!isDict(codedValue)) return null;
  const id = codedValue["@id"];
  if (typeof id !== "string") return null;
  const uri = expandCompactUri(id, prefixes);
  return {
    value: { uri, label: labels.get(uri) },
    supportingText: getSupportingText(node),
  };
}

function resolveNumericAnnotation(
  node: Dict,
  prefixes: Map<string, string>,
): NumericAnnotation | null {
  if (shouldSkip(node, prefixes)) return null;
  const value = resolveNumericValue(node["codedValue"]);
  if (value === undefined) return null;
  return { value, supportingText: getSupportingText(node) };
}

function resolveStringAnnotation(
  node: Dict,
  prefixes: Map<string, string>,
): StringAnnotation | null {
  if (shouldSkip(node, prefixes)) return null;
  const value = resolveStringValue(node["codedValue"]);
  if (value === undefined) return null;
  return { value, supportingText: getSupportingText(node) };
}

function resolveConceptAnnotations(
  raw: unknown,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): CodedAnnotation<ResolvedConcept>[] {
  return ensureArray(raw)
    .filter(isDict)
    .map((n) => resolveConceptAnnotation(n, prefixes, labels))
    .filter((a): a is CodedAnnotation<ResolvedConcept> => a !== null);
}

function resolveStringAnnotations(
  raw: unknown,
  prefixes: Map<string, string>,
): StringAnnotation[] {
  return ensureArray(raw)
    .filter(isDict)
    .map((n) => resolveStringAnnotation(n, prefixes))
    .filter((a): a is StringAnnotation => a !== null);
}

/**
 * Read an optional nested annotation from `raw[key]`. Returns undefined when
 * the field is absent or not a dict; otherwise delegates to `parse`.
 */
function parseOptional<T>(
  raw: Dict,
  key: string,
  parse: (node: Dict) => T | null,
): T | undefined {
  const node = raw[key];
  return isDict(node) ? parse(node) ?? undefined : undefined;
}

/**
 * Resolve a property that may be either:
 *  - a full object (parse it),
 *  - a string blank-node reference like "_:intervention" (look it up in the
 *    registry built during pass 1),
 *  - missing/something else (data is null).
 */
function resolveRef<T extends { id: string }>(
  raw: unknown,
  blankNodes: Map<string, Dict>,
  parse: (node: Dict) => T,
): { data: T | null; ref?: string } {
  if (isDict(raw)) {
    const data = parse(raw);
    return { data, ref: data.id || undefined };
  }
  if (typeof raw === "string") {
    const resolved = blankNodes.get(raw);
    if (!resolved) {
      console.warn(
        `[investigationParser] Unresolved blank-node reference: ${raw}`,
      );
    }
    return { data: resolved ? parse(resolved) : null, ref: raw };
  }
  return { data: null };
}

function parseIntervention(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): InterventionData {
  const descriptions = ensureArray(node["description"])
    .map(getString)
    .filter((d): d is string => d !== undefined);
  const educationThemes = resolveConceptAnnotations(
    node["educationTheme"],
    prefixes,
    labels,
  );
  const implementationDescriptions = resolveStringAnnotations(
    node["implementationDescription"],
    prefixes,
  );

  return {
    id: getString(node["@id"]) ?? "",
    name: getString(node["name"]),
    descriptions: descriptions.length > 0 ? descriptions : undefined,
    educationThemes: educationThemes.length > 0 ? educationThemes : undefined,
    duration: parseOptional(node, "duration", (n) =>
      resolveNumericAnnotation(n, prefixes),
    ),
    implementerType: parseOptional(node, "implementerType", (n) =>
      resolveConceptAnnotation(n, prefixes, labels),
    ),
    implementationFidelity: parseOptional(node, "implementationFidelity", (n) =>
      resolveConceptAnnotation(n, prefixes, labels),
    ),
    implementationName: parseOptional(node, "implementationName", (n) =>
      resolveStringAnnotation(n, prefixes),
    ),
    implementationDescriptions:
      implementationDescriptions.length > 0
        ? implementationDescriptions
        : undefined,
    funderIntervention: parseOptional(node, "funderIntervention", (n) =>
      resolveStringAnnotation(n, prefixes),
    ),
  };
}

function parseControlCondition(node: Dict): ControlConditionData {
  return {
    id: getString(node["@id"]) ?? "",
    description: getString(node["description"]),
  };
}

function parseContext(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): ContextData {
  const educationLevels = resolveConceptAnnotations(
    node["educationLevel"],
    prefixes,
    labels,
  );
  const settings = resolveConceptAnnotations(
    node["setting"],
    prefixes,
    labels,
  );
  const participants = resolveStringAnnotations(node["participants"], prefixes);
  const countries = resolveStringAnnotations(node["country"], prefixes);

  return {
    id: getString(node["@id"]) ?? "",
    educationLevels: educationLevels.length > 0 ? educationLevels : undefined,
    settings: settings.length > 0 ? settings : undefined,
    countries: countries.length > 0 ? countries : undefined,
    countryLevel1: parseOptional(node, "countryLevel1", (n) =>
      resolveStringAnnotation(n, prefixes),
    ),
    participants: participants.length > 0 ? participants : undefined,
  };
}

function getIdRef(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (isDict(v) && typeof v["@id"] === "string") return v["@id"] as string;
  return undefined;
}

function resolveConceptRef(
  v: unknown,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): ResolvedConcept | undefined {
  const id = getIdRef(v);
  if (!id) return undefined;
  const uri = expandCompactUri(id, prefixes);
  return { uri, label: labels.get(uri) };
}

function parseArm(node: Dict): ArmData {
  const numField = (key: string) => resolveNumericValue(node[key]);
  return {
    id: getString(node["@id"]) ?? "",
    conditionRef: getIdRef(node["forCondition"]),
    n: numField("n"),
    mean: numField("mean"),
    sd: numField("sd"),
    se: numField("se"),
    preMean: numField("preMean"),
    preSd: numField("preSd"),
    clusterCount: numField("clusterCount"),
    icc: numField("icc"),
    events: numField("events"),
  };
}

function parseEffectEstimate(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): EffectEstimateData {
  const derivedFromIds = ensureArray(node["derivedFrom"])
    .map(getIdRef)
    .filter((s): s is string => s !== undefined);
  return {
    pointEstimate: resolveNumericValue(node["pointEstimate"]),
    standardError: resolveNumericValue(node["standardError"]),
    confidenceLevel: resolveNumericValue(node["confidenceLevel"]),
    ciLower: resolveNumericValue(node["confidenceIntervalLower"]),
    ciUpper: resolveNumericValue(node["confidenceIntervalUpper"]),
    effectSizeMetric: resolveConceptRef(node["effectSizeMetric"], prefixes, labels),
    estimateSource: resolveConceptRef(node["estimateSource"], prefixes, labels),
    baselineAdjusted:
      typeof node["baselineAdjusted"] === "boolean"
        ? (node["baselineAdjusted"] as boolean)
        : undefined,
    clusteringAdjusted: resolveStringValue(node["clusteringAdjusted"]),
    derivedFromIds: derivedFromIds.length > 0 ? derivedFromIds : undefined,
  };
}

function parseOutcome(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): OutcomeData {
  const outcomes = resolveConceptAnnotations(
    node["outcome"],
    prefixes,
    labels,
  );
  return {
    outcomes: outcomes.length > 0 ? outcomes : undefined,
    name: getString(node["name"]),
    description: getString(node["description"]),
  };
}

function parseSingleFinding(
  raw: Dict,
  blankNodes: Map<string, Dict>,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): FindingData {
  const interv = resolveRef(raw["evaluates"], blankNodes, (n) =>
    parseIntervention(n, prefixes, labels),
  );
  const ctrl = resolveRef(raw["comparedTo"], blankNodes, parseControlCondition);
  const ctx = resolveRef(raw["hasContext"], blankNodes, (n) =>
    parseContext(n, prefixes, labels),
  );

  const outcome = parseOptional(raw, "hasOutcome", (n) =>
    parseOutcome(n, prefixes, labels),
  );

  // sampleSize can also be a blank-node reference for later findings
  let sampleSize: NumericAnnotation | undefined;
  const ssNode = raw["sampleSize"];
  if (isDict(ssNode)) {
    sampleSize = resolveNumericAnnotation(ssNode, prefixes) ?? undefined;
  } else if (typeof ssNode === "string") {
    const resolved = blankNodes.get(ssNode);
    if (resolved) {
      sampleSize = resolveNumericAnnotation(resolved, prefixes) ?? undefined;
    } else {
      console.warn(
        `[investigationParser] Unresolved blank-node reference: ${ssNode}`,
      );
    }
  }

  const sampleFeatures = resolveConceptAnnotations(
    raw["sampleFeatures"],
    prefixes,
    labels,
  );

  const arms = ensureArray(raw["hasArmData"]).filter(isDict).map(parseArm);
  const effectEstimates = ensureArray(raw["hasEffectEstimate"])
    .filter(isDict)
    .map((n) => parseEffectEstimate(n, prefixes, labels));

  return {
    intervention: interv.data,
    interventionRef: interv.ref,
    control: ctrl.data,
    controlRef: ctrl.ref,
    context: ctx.data,
    contextRef: ctx.ref,
    outcome: outcome ?? null,
    sampleSize,
    attrition: parseOptional(raw, "attrition", (n) =>
      resolveNumericAnnotation(n, prefixes),
    ),
    cost: parseOptional(raw, "cost", (n) => resolveStringAnnotation(n, prefixes)),
    groupDifferences: parseOptional(raw, "groupDifferences", (n) =>
      resolveStringAnnotation(n, prefixes),
    ),
    sampleFeatures: sampleFeatures.length > 0 ? sampleFeatures : undefined,
    arms: arms.length > 0 ? arms : undefined,
    effectEstimates: effectEstimates.length > 0 ? effectEstimates : undefined,
  };
}

function parseFindings(
  investigation: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): FindingData[] {
  const rawFindings = ensureArray(investigation["hasFinding"]);

  // Pass 1: Build blank node registry from full objects
  const blankNodes = new Map<string, Dict>();
  for (const raw of rawFindings) {
    if (!isDict(raw)) continue;
    for (const key of ["evaluates", "comparedTo", "hasContext", "sampleSize"]) {
      const child = raw[key];
      if (isDict(child) && typeof child["@id"] === "string") {
        blankNodes.set(child["@id"] as string, child);
      }
    }
  }

  // Pass 2: Parse each finding, resolving blank node references
  return rawFindings
    .filter(isDict)
    .map((raw) => parseSingleFinding(raw, blankNodes, prefixes, labels));
}

/**
 * Extract the isRetracted flag directly from raw linked data, without
 * needing vocabulary or context resolution. This ensures retraction state
 * is always available even when vocab/context fetches fail.
 */
export function extractIsRetracted(data: Record<string, unknown>): boolean {
  const investigation = isDict(data["hasInvestigation"])
    ? (data["hasInvestigation"] as Dict)
    : data;
  return investigation["isRetracted"] === true;
}

/**
 * Parse a LinkedDataEnhancement's data dict into investigation-level metadata.
 *
 * The data dict has @type "LinkedDataEnhancement" at root, with the investigation
 * nested under hasInvestigation. Compact URIs are expanded using the provided
 * prefix map, then resolved to labels via the vocabulary label map.
 */
export function parseInvestigation(
  data: Record<string, unknown>,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): InvestigationData {
  const investigation = isDict(data["hasInvestigation"])
    ? (data["hasInvestigation"] as Dict)
    : data;

  return {
    documentType: parseOptional(investigation, "documentType", (n) =>
      resolveConceptAnnotation(n, prefixes, labels),
    ),
    isRetracted: investigation["isRetracted"] === true,
    findings: parseFindings(investigation, prefixes, labels),
  };
}
