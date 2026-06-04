import { proxyVocabUrl } from "@/config";
import { expandCompactUri, extractPrefixes } from "./contextService";

type JsonLdRef = string | { "@id": string };

interface JsonLdGraphEntry {
  "@id"?: string;
  "@type"?: string | string[];
  "skos:prefLabel"?: string;
  "skos:definition"?: string;
  "skos:broader"?: JsonLdRef | JsonLdRef[];
  "skos:hasTopConcept"?: JsonLdRef | JsonLdRef[];
  "dct:title"?: string;
  "rdfs:label"?: string;
  [key: string]: unknown;
}

interface VocabularyJsonLd {
  "@graph"?: JsonLdGraphEntry[];
}

export interface Concept {
  uri: string;
  label: string;
  definition?: string;
  narrower?: Concept[];
}

export interface ConceptScheme {
  uri: string;
  label: string;
  topConcepts: Concept[];
}

/**
 * Display form of a SKOS scheme label: "Document Type Scheme" → "Document Type".
 * The trailing "Scheme" word is implementation detail of the SKOS model and
 * noise to the reader. Shared by the filter drawer and the evidence map so both
 * name schemes the same way.
 */
export function schemeDisplayLabel(label: string): string {
  return label.replace(/\s+Scheme$/i, "");
}

export interface VocabularyData {
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions: Map<string, string>;
  schemes: ConceptScheme[];
}

const SKOS_CONCEPT = "skos:Concept";
const SKOS_CONCEPT_SCHEME = "skos:ConceptScheme";

function toJsonLdUrl(vocabularyUrl: string): string {
  return toExtension(vocabularyUrl, "jsonld");
}

export function toTurtleUrl(vocabularyUrl: string): string {
  return toExtension(vocabularyUrl, "ttl");
}

function toExtension(vocabularyUrl: string, ext: "jsonld" | "ttl"): string {
  const url = new URL(vocabularyUrl);
  url.pathname =
    url.pathname
      .replace(/\/+$/, "")
      .replace(/\.(jsonld|json|ttl|rdf|xml)$/, "") + `.${ext}`;
  return url.toString();
}

function extractRefId(ref: JsonLdRef | undefined): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "@id" in ref) return ref["@id"];
  return undefined;
}

function extractFirstRefId(
  value: JsonLdRef | JsonLdRef[] | undefined,
): string | undefined {
  if (!value) return undefined;
  const first = Array.isArray(value) ? value[0] : value;
  return extractRefId(first);
}

function extractAllRefIds(
  value: JsonLdRef | JsonLdRef[] | undefined,
): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map(extractRefId)
    .filter((id): id is string => typeof id === "string");
}

interface RawScheme {
  uri: string;
  label: string;
  topConceptUris: string[];
}

/**
 * Build concept lookup maps and the scheme tree from the vocabulary @graph.
 *
 * SKOS allows polyhierarchy; `broader` keeps only the first parent and the
 * scheme tree mirrors that single-parent view.
 *
 * All `@id`s are expanded to full IRIs via the document's own `@context` prefix
 * map. The published vocabulary mints concept IDs as absolute IRIs but writes
 * scheme IDs as compact CURIEs (`esea:…`); expanding here normalizes both so a
 * scheme's `uri` matches the form the cross-facets endpoint and concept URIs use.
 * Falls back to the raw value when no prefix matches (e.g. no `@context`).
 */
export function buildVocabularyData(doc: VocabularyJsonLd): VocabularyData {
  const prefixes = extractPrefixes(doc as Record<string, unknown>);
  const expand = (uri: string): string => expandCompactUri(uri, prefixes);

  const labels = new Map<string, string>();
  const broader = new Map<string, string>();
  const definitions = new Map<string, string>();
  const rawSchemes: RawScheme[] = [];

  for (const entry of doc["@graph"] ?? []) {
    if (!entry["@id"]) continue;
    const id = expand(entry["@id"]);
    const types = Array.isArray(entry["@type"])
      ? entry["@type"]
      : [entry["@type"]];

    if (types.includes(SKOS_CONCEPT)) {
      if (entry["skos:prefLabel"]) {
        labels.set(id, entry["skos:prefLabel"]);
      }
      if (entry["skos:definition"]) {
        definitions.set(id, entry["skos:definition"]);
      }
      const broaderUri = extractFirstRefId(entry["skos:broader"]);
      if (broaderUri) {
        broader.set(id, expand(broaderUri));
      }
      continue;
    }

    if (types.includes(SKOS_CONCEPT_SCHEME)) {
      const label = entry["dct:title"] ?? entry["rdfs:label"];
      if (!label) continue;
      rawSchemes.push({
        uri: id,
        label,
        topConceptUris: extractAllRefIds(entry["skos:hasTopConcept"]).map(expand),
      });
    }
  }

  const childrenByUri = new Map<string, string[]>();
  for (const [child, parent] of broader) {
    const siblings = childrenByUri.get(parent);
    if (siblings) siblings.push(child);
    else childrenByUri.set(parent, [child]);
  }

  function buildConcept(uri: string, visited: Set<string>): Concept | null {
    if (visited.has(uri)) return null;
    const label = labels.get(uri);
    if (!label) return null;
    visited.add(uri);

    const concept: Concept = { uri, label };
    const definition = definitions.get(uri);
    if (definition) concept.definition = definition;

    const narrower = (childrenByUri.get(uri) ?? [])
      .map((childUri) => buildConcept(childUri, visited))
      .filter((c): c is Concept => c !== null);
    if (narrower.length > 0) concept.narrower = narrower;

    return concept;
  }

  const schemes: ConceptScheme[] = rawSchemes.map((raw) => ({
    uri: raw.uri,
    label: raw.label,
    topConcepts: raw.topConceptUris
      .map((uri) => buildConcept(uri, new Set()))
      .filter((c): c is Concept => c !== null),
  }));

  return { labels, broader, definitions, schemes };
}

/**
 * Fetch a vocabulary.jsonld file and build the concept label and broader maps.
 *
 * @param vocabularyUrl Vocabulary URL — any existing extension or trailing slash
 *   is normalized to ".jsonld" automatically.
 */
export async function fetchVocabulary(
  vocabularyUrl: string,
): Promise<VocabularyData> {
  const url = proxyVocabUrl(toJsonLdUrl(vocabularyUrl));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch vocabulary: ${response.status} ${url}`);
  }
  const doc: VocabularyJsonLd = await response.json();
  return buildVocabularyData(doc);
}

const vocabularyCache = new Map<string, Promise<VocabularyData>>();

/** @internal Clear the vocabulary cache. Exported for testing only. */
export function _resetVocabularyCache(): void {
  vocabularyCache.clear();
}

/** Cached vocabulary fetch — deduplicates concurrent requests. */
export function getCachedVocabulary(
  vocabularyUrl: string,
): Promise<VocabularyData> {
  const key = toJsonLdUrl(vocabularyUrl);
  let cached = vocabularyCache.get(key);
  if (!cached) {
    cached = fetchVocabulary(vocabularyUrl).catch((err) => {
      vocabularyCache.delete(key);
      throw err;
    });
    vocabularyCache.set(key, cached);
  }
  return cached;
}
