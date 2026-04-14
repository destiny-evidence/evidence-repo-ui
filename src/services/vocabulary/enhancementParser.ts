import { graph, parse, Namespace, NamedNode } from "rdflib";

const EVREPO = Namespace("https://vocab.evidence-repository.org/");

/**
 * Parse a linked data enhancement's JSON-LD data and extract all concept URIs
 * referenced via evrepo:codedValue triples.
 *
 * rdflib expands compact URIs using the @context during parsing, so the
 * returned URIs are fully expanded.
 */
export async function extractConceptUris(
  data: object,
): Promise<Set<string>> {
  const text = JSON.stringify(data);
  const store = graph();

  await new Promise<void>((resolve, reject) => {
    parse(text, store, "urn:enhancement:", "application/ld+json", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const concepts = new Set<string>();
  for (const st of store.match(null, EVREPO("codedValue"), null)) {
    if (st.object instanceof NamedNode) {
      concepts.add(st.object.value);
    }
  }
  return concepts;
}
