import "./TagGroup.css";

export interface HierarchicalTag {
  parent?: string;
  label: string;
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
          return (
            <span key={`${tag.label}-${i}`} class="tag-group__tag">
              {tag.parent && (
                <>
                  <span class="tag-group__tag-parent">{tag.parent}</span>
                  <span class="tag-group__tag-sep"> › </span>
                </>
              )}
              <span class="tag-group__tag-child">{tag.label}</span>
            </span>
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
