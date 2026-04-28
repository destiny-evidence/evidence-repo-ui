import { proxyVocabUrl } from "@/config";

interface JsonLdGraphEntry {
  "@id"?: string;
  "@type"?: string | string[];
  "skos:prefLabel"?: string;
  "skos:definition"?: string;
  "skos:broader"?: string | { "@id": string } | Array<string | { "@id": string }>;
  [key: string]: unknown;
}

interface VocabularyJsonLd {
  "@graph"?: JsonLdGraphEntry[];
}

export interface VocabularyData {
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions: Map<string, string>;
}

const SKOS_CONCEPT = "skos:Concept";

/** Normalize a vocabulary URL to its .jsonld form. */
function toJsonLdUrl(vocabularyUrl: string): string {
  const url = new URL(vocabularyUrl);
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\.(jsonld|json|ttl|rdf|xml)$/, "") + ".jsonld";
  return url.toString();
}

function extractBroaderUri(
  value: JsonLdGraphEntry["skos:broader"],
): string | undefined {
  if (!value) return undefined;
  // SKOS allows polyhierarchy; we surface only the first broader for breadcrumb display.
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "@id" in first) return first["@id"];
  return undefined;
}

/**
 * Build concept URI → prefLabel and child URI → parent URI maps from the
 * vocabulary @graph.
 *
 * Filters for entries that are skos:Concept (by checking @type). The @id values
 * in the published vocabulary are already full URIs, so no expansion is needed.
 */
export function buildVocabularyData(doc: VocabularyJsonLd): VocabularyData {
  const labels = new Map<string, string>();
  const broader = new Map<string, string>();
  const definitions = new Map<string, string>();
  for (const entry of doc["@graph"] ?? []) {
    if (!entry["@id"]) continue;
    const types = Array.isArray(entry["@type"])
      ? entry["@type"]
      : [entry["@type"]];
    if (!types.includes(SKOS_CONCEPT)) continue;
    if (entry["skos:prefLabel"]) {
      labels.set(entry["@id"], entry["skos:prefLabel"]);
    }
    if (entry["skos:definition"]) {
      definitions.set(entry["@id"], entry["skos:definition"]);
    }
    const broaderUri = extractBroaderUri(entry["skos:broader"]);
    if (broaderUri) {
      broader.set(entry["@id"], broaderUri);
    }
  }
  return { labels, broader, definitions };
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
