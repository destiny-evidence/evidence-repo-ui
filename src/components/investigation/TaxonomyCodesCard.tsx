import { TagGroup } from "../common/TagGroup";
import type { HierarchicalTag } from "../common/TagGroup";
import type { TaxonomyGroup, TaxoNode } from "@/services/taxonomyCodesUtils";
import "./TaxonomyCodesCard.css";

interface TaxonomyCodesCardProps {
  groups: TaxonomyGroup[];
  vocabUnavailable?: boolean;
}

// Split one nesting level into chips (applied concepts) and sub-heading blocks
// (non-applied ancestors). An applied node's own children are hoisted up to its
// level, so a coded parent and its coded child both render — neither is dropped.
function partition(nodes: readonly TaxoNode[]): {
  tags: HierarchicalTag[];
  subheadings: TaxoNode[];
} {
  const tags: HierarchicalTag[] = [];
  const subheadings: TaxoNode[] = [];
  for (const n of nodes) {
    if (n.applied) {
      tags.push({ label: n.label, definition: n.definition });
      const hoisted = partition(n.children);
      tags.push(...hoisted.tags);
      subheadings.push(...hoisted.subheadings);
    } else {
      subheadings.push(n);
    }
  }
  return { tags, subheadings };
}

function Nodes({ nodes }: { nodes: TaxoNode[] }) {
  const { tags, subheadings } = partition(nodes);
  return (
    <>
      {tags.length > 0 && <TagGroup tags={tags} />}
      {subheadings.map((a) => (
        <div key={a.uri} class="taxonomy-codes-card__subgroup">
          <h4 class="taxonomy-codes-card__subheading">{a.label}</h4>
          <Nodes nodes={a.children} />
        </div>
      ))}
    </>
  );
}

function SchemeBlock({ group }: { group: TaxonomyGroup }) {
  return (
    <section class="taxonomy-codes-card__group">
      <h3 class="taxonomy-codes-card__scheme lg-section-label">
        {group.schemeLabel}
      </h3>
      <Nodes nodes={group.nodes} />
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
