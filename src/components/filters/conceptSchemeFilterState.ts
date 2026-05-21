export interface Concept {
  uri: string;
  label: string;
  definition?: string;
  narrower?: Concept[];
}

export interface ConceptScheme {
  uri: string;
  label: string;
  topConcepts: Concept[];
}

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
  uri: string,
): ConceptSchemeFilterState {
  const next = new Set(state);
  if (next.has(uri)) next.delete(uri);
  else next.add(uri);
  return brand(next);
}

// Toggles the clicked concept plus all of its narrower descendants together.
// Direction is set by the clicked concept's current state: if it is selected,
// the whole subtree is cleared; otherwise the whole subtree is added. This
// loses any independent child selections on deselect — a deliberate tradeoff
// for predictable subtree semantics.
export function toggleConceptSubtree(
  state: ConceptSchemeFilterState,
  concept: Concept,
): ConceptSchemeFilterState {
  const subtree = walkConcepts([concept]);
  const next = new Set(state);
  if (next.has(concept.uri)) {
    for (const c of subtree) next.delete(c.uri);
  } else {
    for (const c of subtree) next.add(c.uri);
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

export function toLuceneFragment(
  state: ConceptSchemeFilterState,
  scheme: ConceptScheme,
): string {
  const clauses: string[] = [];
  for (const concept of walkConcepts(scheme.topConcepts)) {
    if (state.has(concept.uri)) {
      clauses.push(`linked_data_concepts:"${concept.uri}"`);
    }
  }
  if (clauses.length === 0) return "";
  if (clauses.length === 1) return clauses[0];
  return `(${clauses.join(" OR ")})`;
}
