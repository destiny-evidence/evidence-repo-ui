import { proxyVocabUrl } from "@/config";

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

export interface ConceptScheme {
  /** Human-readable scheme title (dct:title, falling back to rdfs:label). */
  title: string;
  /** Concept URIs that are direct children of this scheme (skos:hasTopConcept). */
  topConcepts: string[];
}

export interface VocabularyData {
  labels: Map<string, string>;
  broader: Map<string, string>;
  definitions: Map<string, string>;
  /** Concept scheme URI → scheme metadata. Keyed by the @id as it appears in
   *  the vocabulary, which is typically a compact URI (e.g. "esea:DocumentTypeScheme")
   *  — matching how concept entries reference their scheme via skos:inScheme. */
  schemes: Map<string, ConceptScheme>;
  /** Parent concept URI → child concept URIs. Derived as the inverse of
   *  skos:broader so it covers every non-top concept exactly once; top-level
   *  children of a scheme are exposed via `schemes[uri].topConcepts`. */
  narrower: Map<string, string[]>;
}

const SKOS_CONCEPT = "skos:Concept";
const SKOS_CONCEPT_SCHEME = "skos:ConceptScheme";

/** Normalize a vocabulary URL to its .jsonld form. */
function toJsonLdUrl(vocabularyUrl: string): string {
  const url = new URL(vocabularyUrl);
  url.pathname =
    url.pathname
      .replace(/\/+$/, "")
      .replace(/\.(jsonld|json|ttl|rdf|xml)$/, "") + ".jsonld";
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

/**
 * Build concept and scheme lookup maps from the vocabulary @graph.
 *
 * - Concept entries (skos:Concept) contribute to `labels`, `broader`, and
 *   `definitions`.
 * - ConceptScheme entries (skos:ConceptScheme) contribute to `schemes` with
 *   their title and top concepts.
 * - `narrower` is the inverse of `broader`, computed in a second pass once
 *   all concepts have been seen.
 *
 * SKOS allows polyhierarchy; `broader` keeps only the first parent (used for
 * breadcrumb display in the existing UI), so `narrower` follows the same single-
 * parent view to stay consistent.
 */
export function buildVocabularyData(doc: VocabularyJsonLd): VocabularyData {
  const labels = new Map<string, string>();
  const broader = new Map<string, string>();
  const definitions = new Map<string, string>();
  const schemes = new Map<string, ConceptScheme>();

  for (const entry of doc["@graph"] ?? []) {
    if (!entry["@id"]) continue;
    const types = Array.isArray(entry["@type"])
      ? entry["@type"]
      : [entry["@type"]];

    if (types.includes(SKOS_CONCEPT)) {
      if (entry["skos:prefLabel"]) {
        labels.set(entry["@id"], entry["skos:prefLabel"]);
      }
      if (entry["skos:definition"]) {
        definitions.set(entry["@id"], entry["skos:definition"]);
      }
      const broaderUri = extractFirstRefId(entry["skos:broader"]);
      if (broaderUri) {
        broader.set(entry["@id"], broaderUri);
      }
      continue;
    }

    if (types.includes(SKOS_CONCEPT_SCHEME)) {
      const title = entry["dct:title"] ?? entry["rdfs:label"];
      if (!title) continue;
      schemes.set(entry["@id"], {
        title,
        topConcepts: extractAllRefIds(entry["skos:hasTopConcept"]),
      });
    }
  }

  const narrower = new Map<string, string[]>();
  for (const [child, parent] of broader) {
    const siblings = narrower.get(parent);
    if (siblings) {
      siblings.push(child);
    } else {
      narrower.set(parent, [child]);
    }
  }

  return { labels, broader, definitions, schemes, narrower };
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
