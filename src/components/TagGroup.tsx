import { Tooltip } from "./Tooltip";
import "./TagGroup.css";

export interface HierarchicalTag {
  parent?: string;
  label: string;
  /** Optional skos:definition shown as a tooltip on hover/focus. */
  definition?: string;
}

type Tag = string | HierarchicalTag;

interface TagGroupProps {
  label?: string;
  tags: (Tag | undefined)[];
}

function isHierarchical(tag: Tag): tag is HierarchicalTag {
  return typeof tag === "object" && "label" in tag;
}

export function TagGroup({ label, tags }: TagGroupProps) {
  const validTags = tags.filter(
    (t): t is Tag => t !== undefined && (typeof t !== "string" || t !== ""),
  );
  if (validTags.length === 0) return null;

  return (
    <div class="tag-group">
      {label && <span class="tag-group__label lg-label">{label}</span>}
      {validTags.map((tag, i) => {
        if (isHierarchical(tag)) {
          const hasDefinition = !!tag.definition;
          return (
            <Tooltip key={`${tag.label}-${i}`} text={tag.definition}>
              <span
                class={
                  hasDefinition
                    ? "tag-group__tag tag-group__tag--has-tooltip"
                    : "tag-group__tag"
                }
                tabIndex={hasDefinition ? 0 : undefined}
              >
                {tag.parent && (
                  <>
                    <span class="tag-group__tag-parent">{tag.parent}</span>
                    <span class="tag-group__tag-sep"> › </span>
                  </>
                )}
                <span class="tag-group__tag-child">{tag.label}</span>
              </span>
            </Tooltip>
          );
        }
        return (
          <span key={`${tag}-${i}`} class="tag-group__tag">
            {tag}
          </span>
        );
      })}
    </div>
  );
}
