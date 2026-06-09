import "./FilterActions.css";

interface FilterActionsProps {
  onReset: () => void;
  onApply: () => void;
  applyDisabled: boolean;
}

/**
 * The "Reset all" / "Show results" footer shared by the search drawer and the
 * evidence-map config panel.
 */
export function FilterActions({ onReset, onApply, applyDisabled }: FilterActionsProps) {
  return (
    <footer class="filter-actions">
      <button
        type="button"
        class="filter-actions__btn filter-actions__btn--reset"
        onClick={onReset}
      >
        Reset all
      </button>
      <button
        type="button"
        class="filter-actions__btn filter-actions__btn--apply"
        onClick={onApply}
        disabled={applyDisabled}
      >
        Show results
      </button>
    </footer>
  );
}
