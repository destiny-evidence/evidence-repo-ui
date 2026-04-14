import { graph, parse, Namespace, NamedNode } from "rdflib";

const SKOS = Namespace("http://www.w3.org/2004/02/skos/core#");
const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");

export interface ConceptLabels {
  /** Full concept URI → prefLabel (primary lookup). */
  byUri: Map<string, string>;
  /**
   * Bare identifier → prefLabel (e.g. "C00008" → "Journal Article").
   *
   * TEMPORARY WORKAROUND: Identifiers are globally unique across all concept
   * schemes, so this is safe. This fallback exists because enhancement data
   * currently encodes compact URIs that expand without the scheme path segment
   * (e.g. esea:C00008 → .../C00008 instead of .../DocumentTypeScheme/C00008).
   * Remove once taxonomy-builder#194 and vocabulary-mapping-robot#27 land.
   */
  byIdentifier: Map<string, string>;
}

/**
 * Build concept label maps from the vocabulary graph.
 * Mirrors the server-side `_build_concept_labels()`.
 */
export function buildConceptLabels(
  store: ReturnType<typeof graph>,
): ConceptLabels {
  const byUri = new Map<string, string>();
  const byIdentifier = new Map<string, string>();
  for (const st of store.match(null, SKOS("prefLabel"), null)) {
    const concept = st.subject;
    if (
      concept instanceof NamedNode &&
      store.holds(concept, RDF("type"), SKOS("Concept"))
    ) {
      const label = st.object.value;
      byUri.set(concept.value, label);

      // TEMPORARY WORKAROUND (taxonomy-builder#194): index by last path segment
      const identifier = concept.value.split("/").pop();
      if (identifier) {
        byIdentifier.set(identifier, label);
      }
    }
  }
  return { byUri, byIdentifier };
}

/**
 * Fetch a vocabulary.jsonld file and build the concept label map.
 * rdflib parses JSON-LD asynchronously — we wrap the callback in a Promise.
 */
export async function fetchVocabulary(
  vocabularyUrl: string,
): Promise<ConceptLabels> {
  const url = `${vocabularyUrl}.jsonld`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch vocabulary: ${response.status} ${url}`);
  }
  const text = await response.text();

  const store = graph();
  await new Promise<void>((resolve, reject) => {
    parse(text, store, url, "application/ld+json", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  return buildConceptLabels(store);
}

const vocabularyCache = new Map<string, Promise<ConceptLabels>>();

/** Cached vocabulary fetch — deduplicates concurrent requests. */
export function getCachedVocabulary(
  vocabularyUrl: string,
): Promise<ConceptLabels> {
  let cached = vocabularyCache.get(vocabularyUrl);
  if (!cached) {
    cached = fetchVocabulary(vocabularyUrl);
    vocabularyCache.set(vocabularyUrl, cached);
  }
  return cached;
}
