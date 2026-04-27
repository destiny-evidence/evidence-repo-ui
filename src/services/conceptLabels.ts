import type { CodedAnnotation, ResolvedConcept } from "@/types/investigation";
import type { HierarchicalTag } from "@/components/TagGroup";

/**
 * Build a hierarchical tag for a concept, showing the parent (via skos:broader)
 * as a faded prefix when available.
 */
export function toHierarchicalTag(
  concept: ResolvedConcept,
  labels: Map<string, string>,
  broader: Map<string, string>,
): HierarchicalTag {
  const label = concept.label ?? concept.uri;
  const parentUri = broader.get(concept.uri);
  const parent = parentUri ? labels.get(parentUri) : undefined;
  return parent ? { parent, label } : { label };
}

export function conceptsToTags(
  annotations: CodedAnnotation<ResolvedConcept>[] | undefined,
  labels: Map<string, string>,
  broader: Map<string, string>,
): HierarchicalTag[] {
  return (annotations ?? []).map((a) =>
    toHierarchicalTag(a.value, labels, broader),
  );
}
