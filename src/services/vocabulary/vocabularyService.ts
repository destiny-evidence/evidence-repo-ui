interface JsonLdGraphEntry {
  "@id"?: string;
  "@type"?: string | string[];
  "skos:prefLabel"?: string;
  [key: string]: unknown;
}

interface VocabularyJsonLd {
  "@graph"?: JsonLdGraphEntry[];
}

const SKOS_CONCEPT = "skos:Concept";

/** Normalize a vocabulary URL to its .jsonld form. */
function toJsonLdUrl(vocabularyUrl: string): string {
  return vocabularyUrl.replace(/\/+$/, "").replace(/\.\w+$/, "") + ".jsonld";
}

/**
 * Build a concept URI → prefLabel map from the vocabulary @graph.
 *
 * Filters for entries that are skos:Concept (by checking @type) and have a
 * skos:prefLabel. The @id values in the published vocabulary are already full
 * URIs, so no expansion is needed.
 */
export function buildConceptLabels(
  doc: VocabularyJsonLd,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const entry of doc["@graph"] ?? []) {
    if (!entry["skos:prefLabel"] || !entry["@id"]) continue;
    const types = Array.isArray(entry["@type"])
      ? entry["@type"]
      : [entry["@type"]];
    if (types.includes(SKOS_CONCEPT)) {
      labels.set(entry["@id"], entry["skos:prefLabel"]);
    }
  }
  return labels;
}

/**
 * Fetch a vocabulary.jsonld file and build the concept label map.
 *
 * @param vocabularyUrl Base vocabulary URL without extension or trailing slash
 *   (e.g. "https://vocab.example.org/v1"). ".jsonld" is appended automatically.
 */
export async function fetchVocabulary(
  vocabularyUrl: string,
): Promise<Map<string, string>> {
  const url = toJsonLdUrl(vocabularyUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch vocabulary: ${response.status} ${url}`);
  }
  const doc: VocabularyJsonLd = await response.json();
  return buildConceptLabels(doc);
}

const vocabularyCache = new Map<string, Promise<Map<string, string>>>();

/** Cached vocabulary fetch — deduplicates concurrent requests. */
export function getCachedVocabulary(
  vocabularyUrl: string,
): Promise<Map<string, string>> {
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
