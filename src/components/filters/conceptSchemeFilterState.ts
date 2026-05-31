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

// Lookup maps for one scheme, derived from its tree. `byUri` resolves any
// concept (so we can read a parent's `narrower` to check sibling state);
// `broader` maps a concept URI to its parent's URI, terminating at top
// concepts which have no entry.
export interface ConceptIndex {
  byUri: ReadonlyMap<string, Concept>;
  broader: ReadonlyMap<string, string>;
}

export function buildConceptIndex(scheme: ConceptScheme): ConceptIndex {
  const byUri = new Map<string, Concept>();
  const broader = new Map<string, string>();
  const walk = (concept: Concept, parentUri?: string) => {
    byUri.set(concept.uri, concept);
    if (parentUri) broader.set(concept.uri, parentUri);
    if (concept.narrower) {
      for (const child of concept.narrower) walk(child, concept.uri);
    }
  };
  for (const top of scheme.topConcepts) walk(top);
  return { byUri, broader };
}

// Toggles a single concept URI. Subtree cascade and ancestor auto-rollup
// previously lived here, but interacted badly with the backend's literal-URI
// matching: clicking a parent would silently AND its URI into the query,
// excluding docs tagged only at narrower levels (destiny-repository#655).
// Selecting a parent now means "literally this URI" — subtree expansion
// returns when destiny-repository#655 / #712 ship and the backend matches
// narrower concepts implicitly.
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

// Buckets selections into sibling-set groups for the backend's `concept=`
// param: one group per common broader URI, with top concepts keyed by the
// scheme URI so they share a synthetic root. Auto-rollup can leave a parent
// + every descendant selected; they land in separate groups (disjoint sibling
// sets), which is what the backend validates.
export function toConceptFilterGroups(
  state: ConceptSchemeFilterState,
  scheme: ConceptScheme,
): string[][] {
  if (state.size === 0) return [];
  const index = buildConceptIndex(scheme);
  const groups = new Map<string, string[]>();
  for (const concept of walkConcepts(scheme.topConcepts)) {
    if (!state.has(concept.uri)) continue;
    const groupKey = index.broader.get(concept.uri) ?? scheme.uri;
    let group = groups.get(groupKey);
    if (!group) {
      group = [];
      groups.set(groupKey, group);
    }
    group.push(concept.uri);
  }
  return Array.from(groups.values());
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
