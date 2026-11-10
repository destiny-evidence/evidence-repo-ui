import { WarningIcon } from "@/components/common/icons";

// Styled in VisualisePage.css, alongside the map views it sits in.
export function NoMatchesBanner({
  countNoun,
  onReset,
}: {
  countNoun: string;
  onReset: () => void;
}) {
  return (
    <div class="evidence-map-view__banner" role="status">
      <WarningIcon />
      <span class="evidence-map-view__banner-text">
        No {countNoun} match the current filters. Please update the filters and
        try again.
      </span>
      <button type="button" class="evidence-map-view__banner-reset" onClick={onReset}>
        Reset all
      </button>
    </div>
  );
}
