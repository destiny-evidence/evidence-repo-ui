import { TagGroup } from "../common/TagGroup";
import type { HierarchicalTag } from "../common/TagGroup";
import type { TaxonomyGroup, TaxoNode } from "@/services/taxonomyCodesUtils";
import "./TaxonomyCodesCard.css";

interface TaxonomyCodesCardProps {
  groups: TaxonomyGroup[];
  vocabUnavailable?: boolean;
}

// Flatten a scheme's pruned tree into one tag per coded concept, carrying its
// immediate ancestor's label as a breadcrumb (rendered "Parent › Child" inline,
// matching the findings cards). Non-applied ancestors are not tags themselves;
// they only supply the breadcrumb for their coded descendants.
function flatten(nodes: readonly TaxoNode[], parent?: string): HierarchicalTag[] {
  const tags: HierarchicalTag[] = [];
  for (const n of nodes) {
    if (n.applied) {
      tags.push({ label: n.label, definition: n.definition, parent });
    }
    tags.push(...flatten(n.children, n.label));
  }
  return tags;
}

function SchemeBlock({ group }: { group: TaxonomyGroup }) {
  return (
    <section class="taxonomy-codes-card__group">
      <h3 class="taxonomy-codes-card__scheme lg-section-label">
        {group.schemeLabel}
      </h3>
      <TagGroup tags={flatten(group.nodes)} />
    </section>
  );
}

export function TaxonomyCodesCard({
  groups,
  vocabUnavailable = false,
}: TaxonomyCodesCardProps) {
  if (groups.length === 0) return null;
  return (
    <article class="taxonomy-codes-card lg-card">
      <h2 class="taxonomy-codes-card__title lg-kicker">Taxonomy codes</h2>
      {vocabUnavailable && (
        <p class="taxonomy-codes-card__vocab-note" role="status">
          Vocabulary unavailable — codes are shown as raw identifiers.
        </p>
      )}
      {groups.map((g) => (
        <SchemeBlock key={g.schemeUri} group={g} />
      ))}
    </article>
  );
}
