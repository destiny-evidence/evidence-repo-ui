import type { CodedAnnotation, ResolvedConcept } from "@/types/investigation";
import type { HierarchicalTag } from "@/components/common/TagGroup";

/**
 * Build a hierarchical tag for a concept, showing the parent (via skos:broader)
 * as a faded prefix when available and attaching the skos:definition for use
 * as a hover tooltip.
 */
export function toHierarchicalTag(
  concept: ResolvedConcept,
  labels: Map<string, string>,
  broader: Map<string, string>,
  definitions?: Map<string, string>,
): HierarchicalTag {
  const label = concept.label ?? concept.uri;
  const parentUri = broader.get(concept.uri);
  const parent = parentUri ? labels.get(parentUri) : undefined;
  const definition = definitions?.get(concept.uri);
  return {
    label,
    ...(parent ? { parent } : {}),
    ...(definition ? { definition } : {}),
  };
}

/**
 * Collapse annotations sharing a concept URI (they render as identical pills);
 * distinct supporting text is preserved separately by the source-evidence view.
 */
export function dedupeByUri(
  annotations: CodedAnnotation<ResolvedConcept>[],
): CodedAnnotation<ResolvedConcept>[] {
  const seen = new Set<string>();
  return annotations.filter((a) => {
    if (seen.has(a.value.uri)) return false;
    seen.add(a.value.uri);
    return true;
  });
}

export function conceptsToTags(
  annotations: CodedAnnotation<ResolvedConcept>[] | undefined,
  labels: Map<string, string>,
  broader: Map<string, string>,
  definitions?: Map<string, string>,
): HierarchicalTag[] {
  return dedupeByUri(annotations ?? []).map((a) =>
    toHierarchicalTag(a.value, labels, broader, definitions),
  );
}
