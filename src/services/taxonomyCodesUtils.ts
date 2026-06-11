import type {
  Concept,
  ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import { schemeDisplayLabel } from "@/services/vocabulary/vocabularyService";
import type { ResolvedConcept } from "@/types/investigation";

export interface TaxoNode {
  uri: string;
  label: string;
  definition?: string;
  // true ⇒ the record codes this concept (renders as a tag); false ⇒ an
  // ancestor kept only to anchor a coded descendant (renders as a sub-heading).
  applied: boolean;
  children: TaxoNode[];
}

export interface TaxonomyGroup {
  schemeUri: string;
  schemeLabel: string;
  isGeo: boolean;
  collapsedByDefault: boolean;
  appliedCount: number;
  nodes: TaxoNode[];
}

const OTHER_SCHEME_URI = "__other_codes__";

// Keep only branches that reach an applied concept; ancestors of an applied
// node are retained (applied: false) so they can render as sub-headings.
function pruneTree(
  concepts: readonly Concept[],
  applied: ReadonlySet<string>,
): TaxoNode[] {
  const out: TaxoNode[] = [];
  for (const c of concepts) {
    const children = pruneTree(c.narrower ?? [], applied);
    const isApplied = applied.has(c.uri);
    if (isApplied || children.length > 0) {
      out.push({
        uri: c.uri,
        label: c.label,
        definition: c.definition,
        applied: isApplied,
        children,
      });
    }
  }
  return out;
}

function collectUris(nodes: TaxoNode[], acc: Set<string>): void {
  for (const n of nodes) {
    acc.add(n.uri);
    collectUris(n.children, acc);
  }
}

export function groupAppliedConcepts(
  applied: readonly ResolvedConcept[],
  inScheme: Map<string, string>,
  schemes: readonly ConceptScheme[],
  geographicSchemes: readonly string[],
): TaxonomyGroup[] {
  if (applied.length === 0) return [];

  const labelOf = new Map<string, string | undefined>();
  const bySchemeUri = new Map<string, Set<string>>();
  const knownSchemes = new Set(schemes.map((s) => s.uri));
  const unknown = new Set<string>();

  for (const c of applied) {
    labelOf.set(c.uri, c.label);
    const s = inScheme.get(c.uri);
    if (s && knownSchemes.has(s)) {
      let set = bySchemeUri.get(s);
      if (!set) {
        set = new Set();
        bySchemeUri.set(s, set);
      }
      set.add(c.uri);
    } else {
      unknown.add(c.uri);
    }
  }

  const geo = new Set(geographicSchemes);
  const ordered: (TaxonomyGroup & { order: number })[] = [];

  schemes.forEach((scheme, idx) => {
    const appliedInScheme = bySchemeUri.get(scheme.uri);
    if (!appliedInScheme || appliedInScheme.size === 0) return;
    const nodes = pruneTree(scheme.topConcepts, appliedInScheme);
    // Applied concepts the scheme tree doesn't carry (drift, or a concept coded
    // but absent from topConcepts) still belong here — append them flat.
    const inTree = new Set<string>();
    collectUris(nodes, inTree);
    for (const uri of appliedInScheme) {
      if (!inTree.has(uri)) {
        nodes.push({
          uri,
          label: labelOf.get(uri) ?? uri,
          applied: true,
          children: [],
        });
      }
    }
    const isGeo = geo.has(scheme.uri);
    ordered.push({
      schemeUri: scheme.uri,
      schemeLabel: schemeDisplayLabel(scheme.label),
      isGeo,
      collapsedByDefault: isGeo,
      appliedCount: appliedInScheme.size,
      nodes,
      order: idx,
    });
  });

  // Topical (isGeo false) before geo; within each, published-vocab order.
  ordered.sort((a, b) => Number(a.isGeo) - Number(b.isGeo) || a.order - b.order);
  const result: TaxonomyGroup[] = ordered.map(({ order: _order, ...g }) => g);

  if (unknown.size > 0) {
    result.push({
      schemeUri: OTHER_SCHEME_URI,
      schemeLabel: "Other codes",
      isGeo: false,
      collapsedByDefault: false,
      appliedCount: unknown.size,
      nodes: [...unknown].map((uri) => ({
        uri,
        label: labelOf.get(uri) ?? uri,
        applied: true,
        children: [],
      })),
    });
  }
  return result;
}
