type Dict = Record<string, unknown>;

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Recursively walk a JSON-LD enhancement and collect all concept URIs
 * referenced via codedValue entries that have an @id (URI references).
 *
 * Numeric (@value with xsd:integer) and string (@value with xsd:string)
 * coded values are excluded — only URI concept references are returned.
 */
export function extractConceptUris(data: object): Set<string> {
  const concepts = new Set<string>();
  walk(data as Dict, concepts);
  return concepts;
}

function walk(node: Dict, concepts: Set<string>): void {
  const codedValue = node["codedValue"];
  if (isDict(codedValue)) {
    const id = codedValue["@id"];
    if (typeof id === "string") {
      concepts.add(id);
    }
  }

  for (const value of Object.values(node)) {
    if (isDict(value)) {
      walk(value, concepts);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isDict(item)) {
          walk(item, concepts);
        }
      }
    }
  }
}
