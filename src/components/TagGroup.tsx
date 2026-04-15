import "./TagGroup.css";

interface TagGroupProps {
  label: string;
  tags: (string | undefined)[];
}

export function TagGroup({ label, tags }: TagGroupProps) {
  const validTags = tags.filter(
    (t): t is string => t !== undefined && t !== "",
  );
  if (validTags.length === 0) return null;

  return (
    <div class="tag-group">
      <span class="tag-group__label">{label}</span>
      {validTags.map((tag) => (
        <span key={tag} class="tag-group__tag">
          {tag}
        </span>
      ))}
    </div>
  );
}
