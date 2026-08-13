import type {
  Concept,
  ConceptScheme,
} from "@/services/vocabulary/vocabularyService";

declare const conceptSchemeStateBrand: unique symbol;
export type ConceptSchemeFilterState = ReadonlySet<string> & {
  readonly [conceptSchemeStateBrand]: true;
};

function brand(set: Set<string>): ConceptSchemeFilterState {
  return set as unknown as ConceptSchemeFilterState;
}

export function emptyConceptSchemeState(): ConceptSchemeFilterState {
  return brand(new Set());
}

export function conceptSchemeStateFromUris(
  uris: Iterable<string>,
): ConceptSchemeFilterState {
  return brand(new Set(uris));
}

export function selectedUris(
  state: ConceptSchemeFilterState,
): readonly string[] {
  return Array.from(state);
}

export function isEmpty(state: ConceptSchemeFilterState): boolean {
  return state.size === 0;
}

export function selectedCount(state: ConceptSchemeFilterState): number {
  return state.size;
}

export function isSelected(
  state: ConceptSchemeFilterState,
  uri: string,
): boolean {
  return state.has(uri);
}

export function summary(state: ConceptSchemeFilterState): string {
  return state.size === 0 ? "" : `${state.size} selected`;
}

export function toggleConcept(
  state: ConceptSchemeFilterState,
  concept: Concept,
): ConceptSchemeFilterState {
  const next = new Set(state);
  if (next.has(concept.uri)) next.delete(concept.uri);
  else next.add(concept.uri);
  return brand(next);
}

function walkConcepts(concepts: Concept[]): Concept[] {
  const all: Concept[] = [];
  for (const concept of concepts) {
    all.push(concept);
    if (concept.narrower) all.push(...walkConcepts(concept.narrower));
  }
  return all;
}

// All of a scheme's selected concepts OR-join into one `concept=` group — the
// backend treats a whole scheme as one sibling set.
// Returned in scheme preorder; URIs not in the tree are dropped (stale URLs).
export function toConceptFilterGroups(
  state: ConceptSchemeFilterState,
  scheme: ConceptScheme,
): string[][] {
  if (state.size === 0) return [];
  const group: string[] = [];
  for (const concept of walkConcepts(scheme.topConcepts)) {
    if (state.has(concept.uri)) group.push(concept.uri);
  }
  return group.length > 0 ? [group] : [];
}

/**
 * Every concept in every scheme, by uri → the labels from its scheme's top
 * concept down to itself. A top concept's path is just its own label. The scheme
 * is not included; callers that want it have it already.
 */
export function indexConceptPaths(
  schemes: ConceptScheme[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const visit = (concepts: Concept[], ancestors: string[]) => {
    for (const concept of concepts) {
      const path = [...ancestors, concept.label];
      index.set(concept.uri, path);
      if (concept.narrower) visit(concept.narrower, path);
    }
  };
  for (const scheme of schemes) visit(scheme.topConcepts, []);
  return index;
}

function indexConceptUrisByScheme(
  schemes: ConceptScheme[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const scheme of schemes) {
    for (const concept of walkConcepts(scheme.topConcepts)) {
      index.set(concept.uri, scheme.uri);
    }
  }
  return index;
}

// Sum of `selectedCount` across every per-scheme state derived from the
// URL. Used to drive the Refine button's badge — each scheme contributes
// its own checkbox count, the drawer never aggregates URIs directly.
export function totalSelectedCount(
  conceptFilters: readonly (readonly string[])[],
  schemes: ConceptScheme[],
): number {
  let total = 0;
  for (const state of parseConceptFilters(conceptFilters, schemes).values()) {
    total += selectedCount(state);
  }
  return total;
}

// URIs that don't belong to any supplied scheme are silently dropped —
// defensive for stale URLs pointing at a vocab that has since changed.
export function parseConceptFilters(
  conceptFilters: readonly (readonly string[])[],
  schemes: ConceptScheme[],
): Map<string, ConceptSchemeFilterState> {
  const uriToScheme = indexConceptUrisByScheme(schemes);
  const buckets = new Map<string, Set<string>>();
  for (const group of conceptFilters) {
    for (const uri of group) {
      const schemeUri = uriToScheme.get(uri);
      if (schemeUri === undefined) continue;
      let bucket = buckets.get(schemeUri);
      if (!bucket) {
        bucket = new Set();
        buckets.set(schemeUri, bucket);
      }
      bucket.add(uri);
    }
  }
  const result = new Map<string, ConceptSchemeFilterState>();
  for (const [schemeUri, uris] of buckets) {
    result.set(schemeUri, conceptSchemeStateFromUris(uris));
  }
  return result;
}
