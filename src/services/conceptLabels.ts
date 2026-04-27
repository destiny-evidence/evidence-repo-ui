import type { CodedAnnotation, ResolvedConcept } from "@/types/investigation";
import type { HierarchicalTag } from "@/components/TagGroup";

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

export function conceptsToTags(
  annotations: CodedAnnotation<ResolvedConcept>[] | undefined,
  labels: Map<string, string>,
  broader: Map<string, string>,
  definitions?: Map<string, string>,
): HierarchicalTag[] {
  return (annotations ?? []).map((a) =>
    toHierarchicalTag(a.value, labels, broader, definitions),
  );
}
