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

// Toggles the clicked concept plus all of its narrower descendants together,
// then reconciles ancestors upward via `index.broader`: at each level the
// parent is selected iff every one of its `narrower` is selected. Recomputing
// from sibling state handles both directions in one pass — selecting the last
// missing sibling rolls a parent in, deselecting any sibling rolls it back out.
// Direction of the initial subtree change is set by the clicked concept's
// current state: if selected, the whole subtree is cleared; otherwise added.
// This loses any independent child selections on deselect — a deliberate
// tradeoff for predictable subtree semantics.
export function toggleConcept(
  state: ConceptSchemeFilterState,
  concept: Concept,
  index: ConceptIndex,
): ConceptSchemeFilterState {
  const subtree = walkConcepts([concept]);
  const next = new Set(state);
  if (next.has(concept.uri)) {
    for (const c of subtree) next.delete(c.uri);
  } else {
    for (const c of subtree) next.add(c.uri);
  }

  let cursor: string | undefined = concept.uri;
  while (cursor) {
    const parentUri = index.broader.get(cursor);
    if (!parentUri) break;
    const parent = index.byUri.get(parentUri);
    const children = parent?.narrower;
    if (!children || children.length === 0) break;
    const allSelected = children.every((c) => next.has(c.uri));
    if (allSelected) next.add(parentUri);
    else next.delete(parentUri);
    cursor = parentUri;
  }

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

// Builds one SearchParams.searchFacets[] entry: an unwrapped, OR-joined
// sequence of linked_data_concepts:"..." clauses for every selected
// concept, with full concept URIs embedded verbatim.
export function toSearchFacet(
  state: ConceptSchemeFilterState,
  scheme: ConceptScheme,
): string {
  const clauses: string[] = [];
  for (const concept of walkConcepts(scheme.topConcepts)) {
    if (state.has(concept.uri)) {
      clauses.push(`linked_data_concepts:"${concept.uri}"`);
    }
  }
  return clauses.join(" OR ");
}
