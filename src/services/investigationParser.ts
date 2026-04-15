import { expandCompactUri } from "./vocabulary/contextService";
import type {
  InvestigationData,
  FindingData,
  InterventionData,
  ControlConditionData,
  ContextData,
  OutcomeData,
  ArmData,
  EffectEstimateData,
  CodedAnnotation,
  ResolvedConcept,
} from "@/types/investigation";

type Dict = Record<string, unknown>;

const SKIP_STATUSES = ["notReported", "notApplicable"];

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function shouldSkip(node: Dict, prefixes: Map<string, string>): boolean {
  const status = node["status"];
  if (typeof status !== "string") return false;
  const expanded = expandCompactUri(status, prefixes);
  const local = expanded.split("/").pop() ?? expanded;
  return SKIP_STATUSES.includes(local);
}

function getString(node: Dict, key: string): string | undefined {
  const v = node[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(node: Dict, key: string): number | undefined {
  const v = node[key];
  return typeof v === "number" ? v : undefined;
}

function getStrings(node: Dict, key: string): string[] {
  return ensureArray(node[key]).filter(
    (v): v is string => typeof v === "string",
  );
}

// ── Annotation extraction ──

function resolveAnnotation<T>(
  node: Dict,
  prefixes: Map<string, string>,
  extractValue: (node: Dict, prefixes: Map<string, string>) => T | null,
): CodedAnnotation<T> | null {
  if (shouldSkip(node, prefixes)) return null;
  const value = extractValue(node, prefixes);
  if (value === null) return null;
  const annotation: CodedAnnotation<T> = { value };
  if (typeof node["supportingText"] === "string") {
    annotation.supportingText = node["supportingText"];
  }
  return annotation;
}

function resolveAnnotations<T>(
  nodes: unknown,
  prefixes: Map<string, string>,
  extractValue: (node: Dict, prefixes: Map<string, string>) => T | null,
): CodedAnnotation<T>[] {
  const results: CodedAnnotation<T>[] = [];
  for (const node of ensureArray(nodes)) {
    if (!isDict(node)) continue;
    const annotation = resolveAnnotation(node, prefixes, extractValue);
    if (annotation) results.push(annotation);
  }
  return results;
}

function extractConcept(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): ResolvedConcept | null {
  const codedValue = node["codedValue"];
  if (!isDict(codedValue)) return null;
  const id = codedValue["@id"];
  if (typeof id !== "string") return null;
  const uri = expandCompactUri(id, prefixes);
  return { uri, label: labels.get(uri) };
}

function extractNumeric(node: Dict): number | null {
  const codedValue = node["codedValue"];
  if (!isDict(codedValue)) return null;
  const val = codedValue["@value"];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function extractString(node: Dict): string | null {
  const codedValue = node["codedValue"];
  if (!isDict(codedValue)) return null;
  const val = codedValue["@value"];
  return typeof val === "string" ? val : null;
}

// ── Section parsers ──

function parseIntervention(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): InterventionData {
  const concepts = (field: string) =>
    resolveAnnotations(node[field], prefixes, (n, p) =>
      extractConcept(n, p, labels),
    );

  return {
    name: getString(node, "name"),
    descriptions: getStrings(node, "description"),
    educationThemes: concepts("educationTheme"),
    duration: isDict(node["duration"])
      ? resolveAnnotation(node["duration"], prefixes, extractNumeric) ?? undefined
      : undefined,
  };
}

function parseControl(node: Dict): ControlConditionData {
  return { descriptions: getStrings(node, "description") };
}

function parseContext(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): ContextData {
  const concepts = (field: string) =>
    resolveAnnotations(node[field], prefixes, (n, p) =>
      extractConcept(n, p, labels),
    );
  const strings = (field: string) =>
    resolveAnnotations(node[field], prefixes, extractString);

  return {
    educationLevels: concepts("educationLevel"),
    settings: concepts("setting"),
    participants: strings("participants"),
    countries: strings("country"),
    sampleFeatures: concepts("sampleFeatures"),
  };
}

function parseOutcome(
  node: Dict,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): OutcomeData {
  return {
    name: getString(node, "name"),
    description: getString(node, "description"),
    outcomeConcepts: resolveAnnotations(node["outcome"], prefixes, (n, p) =>
      extractConcept(n, p, labels),
    ),
  };
}

function parseArmData(
  nodes: unknown,
  conditionMap: Map<string, "intervention" | "control">,
): ArmData[] {
  const results: ArmData[] = [];
  for (const node of ensureArray(nodes)) {
    if (!isDict(node)) continue;
    const id = getString(node, "@id") ?? "";
    const condRef = node["forCondition"];
    const forCondition =
      typeof condRef === "string" ? conditionMap.get(condRef) : undefined;
    if (!forCondition) continue;

    results.push({
      id,
      forCondition,
      n: getNumber(node, "n"),
      mean: getNumber(node, "mean"),
      sd: getNumber(node, "sd"),
    });
  }
  return results;
}

function parseEffectEstimate(
  node: Dict,
  prefixes: Map<string, string>,
): EffectEstimateData {
  const metric = getString(node, "effectSizeMetric");
  return {
    pointEstimate: getNumber(node, "pointEstimate"),
    standardError: getNumber(node, "standardError"),
    confidenceIntervalLower: getNumber(node, "confidenceIntervalLower"),
    confidenceIntervalUpper: getNumber(node, "confidenceIntervalUpper"),
    effectSizeMetric: metric ? expandCompactUri(metric, prefixes) : undefined,
    baselineAdjusted:
      typeof node["baselineAdjusted"] === "boolean"
        ? node["baselineAdjusted"]
        : undefined,
    clusteringAdjusted: getString(node, "clusteringAdjusted"),
    derivedFromIds: ensureArray(node["derivedFrom"]).filter(
      (v): v is string => typeof v === "string",
    ),
  };
}

function parseEffectEstimates(
  nodes: unknown,
  prefixes: Map<string, string>,
): EffectEstimateData[] {
  return ensureArray(nodes)
    .filter(isDict)
    .map((node) => parseEffectEstimate(node, prefixes));
}

// ── Shared node resolution ──

function resolveRef(
  value: unknown,
  sharedNodes: Map<string, Dict>,
): Dict | undefined {
  if (isDict(value)) return value;
  if (typeof value === "string") return sharedNodes.get(value);
  return undefined;
}

function collectSharedNodes(firstFinding: Dict) {
  const sharedNodes = new Map<string, Dict>();
  const conditionMap = new Map<string, "intervention" | "control">();

  for (const [key, type] of [
    ["evaluates", "intervention"],
    ["comparedTo", "control"],
  ] as const) {
    const node = firstFinding[key];
    if (isDict(node)) {
      const id = getString(node, "@id");
      if (id) {
        sharedNodes.set(id, node);
        conditionMap.set(id, type);
      }
    }
  }
  for (const key of ["hasContext", "sampleSize"]) {
    const node = firstFinding[key];
    if (isDict(node)) {
      const id = getString(node, "@id");
      if (id) sharedNodes.set(id, node);
    }
  }

  return { sharedNodes, conditionMap };
}

const EMPTY_CONTEXT: ContextData = {
  educationLevels: [],
  settings: [],
  participants: [],
  sampleFeatures: [],
  countries: [],
};

function parseFinding(
  fNode: Dict,
  sharedNodes: Map<string, Dict>,
  conditionMap: Map<string, "intervention" | "control">,
  prefixes: Map<string, string>,
  labels: Map<string, string>,
): FindingData {
  const interventionDict = resolveRef(fNode["evaluates"], sharedNodes);
  const controlDict = resolveRef(fNode["comparedTo"], sharedNodes);
  const contextDict = resolveRef(fNode["hasContext"], sharedNodes);
  const sampleSizeDict = resolveRef(fNode["sampleSize"], sharedNodes);
  const outcomeDict = isDict(fNode["hasOutcome"]) ? fNode["hasOutcome"] : undefined;

  return {
    intervention: interventionDict
      ? parseIntervention(interventionDict, prefixes, labels)
      : { descriptions: [], educationThemes: [] },
    control: controlDict ? parseControl(controlDict) : { descriptions: [] },
    context: contextDict
      ? parseContext(contextDict, prefixes, labels)
      : EMPTY_CONTEXT,
    outcome: outcomeDict
      ? parseOutcome(outcomeDict, prefixes, labels)
      : { outcomeConcepts: [] },
    sampleSize: sampleSizeDict
      ? resolveAnnotation(sampleSizeDict, prefixes, extractNumeric) ?? undefined
      : undefined,
    armData: parseArmData(fNode["hasArmData"], conditionMap),
    effectEstimates: parseEffectEstimates(fNode["hasEffectEstimate"], prefixes),
  };
}

// ── Top-level parser ──

/**
 * Parse a LinkedDataEnhancement's data dict into typed investigation structures.
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

  const docTypeNode = investigation["documentType"];
  let documentType: CodedAnnotation<ResolvedConcept> | undefined;
  if (isDict(docTypeNode)) {
    documentType =
      resolveAnnotation(docTypeNode, prefixes, (n, p) =>
        extractConcept(n, p, labels),
      ) ?? undefined;
  }

  const isRetracted = investigation["isRetracted"] === true;
  const findingNodes = ensureArray(investigation["hasFinding"]);

  const { sharedNodes, conditionMap } =
    findingNodes.length > 0 && isDict(findingNodes[0])
      ? collectSharedNodes(findingNodes[0] as Dict)
      : { sharedNodes: new Map<string, Dict>(), conditionMap: new Map() };

  const findings = findingNodes
    .filter(isDict)
    .map((fNode) =>
      parseFinding(fNode, sharedNodes, conditionMap, prefixes, labels),
    );

  return { documentType, isRetracted, findings };
}
