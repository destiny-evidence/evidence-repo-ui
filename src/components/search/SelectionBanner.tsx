import "./SelectionBanner.css";

export interface SelectionBannerContent {
  /** e.g. "20 selected" or "All 1,854 selected". */
  countLabel: string;
  /** Optional escalation (extend a manual selection to every match). */
  selectAll?: { label: string; onAction: () => void };
  onClear: () => void;
}

/**
 * The selection summary row shown below the meta bar while a selection is
 * active: the count, an optional "select all matches" escalation, and Clear.
 * `content` is null when nothing is selected.
 */
export function SelectionBanner({
  content,
}: {
  content: SelectionBannerContent | null;
}) {
  if (content === null) return null;

  return (
    <div class="sel-banner">
      <span class="sel-banner__count">{content.countLabel}</span>
      {content.selectAll && (
        <button
          type="button"
          class="sel-banner__action"
          onClick={content.selectAll.onAction}
        >
          {content.selectAll.label}
        </button>
      )}
      <button type="button" class="sel-banner__clear" onClick={content.onClear}>
        Clear all
      </button>
    </div>
  );
}
