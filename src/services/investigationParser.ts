import { expandCompactUri } from "./vocabulary/contextService";
import type {
  InvestigationData,
  CodedAnnotation,
  ResolvedConcept,
} from "@/types/investigation";

type Dict = Record<string, unknown>;

const SKIP_STATUSES = ["notReported", "notApplicable"];

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shouldSkip(node: Dict, prefixes: Map<string, string>): boolean {
  const status = node["status"];
  if (typeof status !== "string") return false;
  const expanded = expandCompactUri(status, prefixes);
  const local = expanded.split(/[/#]/).pop() ?? expanded;
  return SKIP_STATUSES.includes(local);
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
  return { value: { uri, label: labels.get(uri) } };
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

  const docTypeNode = investigation["documentType"];
  const documentType =
    isDict(docTypeNode)
      ? resolveConceptAnnotation(docTypeNode, prefixes, labels) ?? undefined
      : undefined;

  const isRetracted = investigation["isRetracted"] === true;

  return { documentType, isRetracted };
}
