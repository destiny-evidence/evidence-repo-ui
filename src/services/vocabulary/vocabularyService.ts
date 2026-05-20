import { proxyVocabUrl } from "@/config";

interface JsonLdGraphEntry {
  "@id"?: string;
  "@type"?: string | string[];
  "skos:prefLabel"?: string;
  "skos:definition"?: string;
  "skos:broader"?: string | { "@id": string } | Array<string | { "@id": string }>;
  "skos:inScheme"?: string | { "@id": string };
  "dct:title"?: string;
  "rdfs:label"?: string;
  [key: string]: unknown;
}

interface VocabularyJsonLd {
  "@graph"?: JsonLdGraphEntry[];
}

export interface VocabularyData {
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions: Map<string, string>;
  // Concept URI → human-readable title of its skos:ConceptScheme. Empty for
  // concepts that have no skos:inScheme or whose scheme has no title/label.
  // Consumers use this to disambiguate prefLabels that recur across schemes.
  schemes: Map<string, string>;
}

const SKOS_CONCEPT = "skos:Concept";
const SKOS_CONCEPT_SCHEME = "skos:ConceptScheme";

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

function extractSchemeId(
  value: JsonLdGraphEntry["skos:inScheme"],
): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "@id" in value) return value["@id"];
  return undefined;
}

/**
 * Build concept URI → prefLabel and child URI → parent URI maps from the
 * vocabulary @graph. Also collects each concept's owning skos:ConceptScheme
 * title so callers can disambiguate prefLabels that recur across schemes.
 *
 * Filters for entries that are skos:Concept (by checking @type). The @id values
 * in the published vocabulary are already full URIs, so no expansion is needed.
 */
export function buildVocabularyData(doc: VocabularyJsonLd): VocabularyData {
  const labels = new Map<string, string>();
  const broader = new Map<string, string>();
  const definitions = new Map<string, string>();
  // Concept @id → its inScheme @id, captured in the same pass.
  const conceptToSchemeId = new Map<string, string>();
  // Scheme @id → human-readable title. The ESEA vocabulary uses dct:title;
  // older fixtures use rdfs:label — accept either so neither side is brittle.
  const schemeIdToTitle = new Map<string, string>();

  for (const entry of doc["@graph"] ?? []) {
    if (!entry["@id"]) continue;
    const types = Array.isArray(entry["@type"])
      ? entry["@type"]
      : [entry["@type"]];
    if (types.includes(SKOS_CONCEPT_SCHEME)) {
      const title = entry["dct:title"] ?? entry["rdfs:label"];
      if (typeof title === "string") schemeIdToTitle.set(entry["@id"], title);
      continue;
    }
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
    const schemeId = extractSchemeId(entry["skos:inScheme"]);
    if (schemeId) conceptToSchemeId.set(entry["@id"], schemeId);
  }

  const schemes = new Map<string, string>();
  for (const [conceptUri, schemeId] of conceptToSchemeId) {
    const title = schemeIdToTitle.get(schemeId);
    if (title) schemes.set(conceptUri, title);
  }

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
