import { graph, parse, Namespace, NamedNode } from "rdflib";

const SKOS = Namespace("http://www.w3.org/2004/02/skos/core#");
const RDF = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");

/**
 * Build a concept URI → prefLabel map from the vocabulary graph.
 * Mirrors the server-side `_build_concept_labels()`.
 */
export function buildConceptLabels(
  store: ReturnType<typeof graph>,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const st of store.match(null, SKOS("prefLabel"), null)) {
    const concept = st.subject;
    if (
      concept instanceof NamedNode &&
      store.holds(concept, RDF("type"), SKOS("Concept"))
    ) {
      labels.set(concept.value, st.object.value);
    }
  }
  return labels;
}

/**
 * Fetch a vocabulary.jsonld file and build the concept label map.
 * rdflib parses JSON-LD asynchronously — we wrap the callback in a Promise.
 */
export async function fetchVocabulary(
  vocabularyUrl: string,
): Promise<Map<string, string>> {
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

const vocabularyCache = new Map<string, Promise<Map<string, string>>>();

/** Cached vocabulary fetch — deduplicates concurrent requests. */
export function getCachedVocabulary(
  vocabularyUrl: string,
): Promise<Map<string, string>> {
  let cached = vocabularyCache.get(vocabularyUrl);
  if (!cached) {
    cached = fetchVocabulary(vocabularyUrl).catch((err) => {
      vocabularyCache.delete(vocabularyUrl);
      throw err;
    });
    vocabularyCache.set(vocabularyUrl, cached);
  }
  return cached;
}
