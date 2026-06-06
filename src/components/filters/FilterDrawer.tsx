import { useEffect, useId, useRef } from "preact/hooks";
import { FilterCardList } from "./FilterCardList";
import { FilterActions } from "./FilterActions";
import { useFilterDraft, type AppliedFilters } from "./useFilterDraft";
import type { SearchParams } from "@/services/searchParams";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import "./FilterDrawer.css";

export type { AppliedFilters };

interface FilterDrawerProps {
  open: boolean;
  title?: string;
  countNoun?: string;
  // Show the facet-backed country card; off where the `countries` facet is empty (HPV).
  showCountryFacetFilter?: boolean;
  schemes: ConceptScheme[];
  appliedConceptFilters: readonly (readonly string[])[];
  appliedCountryCodes: readonly string[];
  appliedStartYear: number | undefined;
  appliedEndYear: number | undefined;
  // Drives the facet-count fetch alongside the draft. Owned by SearchPage as
  // the source of truth for q / annotations.
  params: SearchParams;
  onApply: (next: AppliedFilters) => void;
  onCancel: () => void;
}

// Gates hook execution on `open` — users who never refine don't fetch facets.
export function FilterDrawer({ open, ...rest }: FilterDrawerProps) {
  if (!open) return null;
  return <FilterDrawerPanel {...rest} />;
}

type FilterDrawerPanelProps = Omit<FilterDrawerProps, "open">;

function FilterDrawerPanel({
  title = "Refine the evidence",
  countNoun = "results",
  showCountryFacetFilter = true,
  schemes,
  appliedConceptFilters,
  appliedCountryCodes,
  appliedStartYear,
  appliedEndYear,
  params,
  onApply,
  onCancel,
}: FilterDrawerPanelProps) {
  const draft = useFilterDraft({
    schemes,
    appliedConceptFilters,
    appliedCountryCodes,
    appliedStartYear,
    appliedEndYear,
    params,
  });
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
    return () => {
      const target = previousFocusRef.current;
      if (target instanceof HTMLElement) target.focus();
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function handleApply() {
    const applied = draft.buildApplied();
    if (applied) onApply(applied);
  }

  return (
    <div class="filter-drawer" role="presentation">
      <div class="filter-drawer__backdrop" aria-hidden="true" />
      <aside
        ref={panelRef}
        class="filter-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header class="filter-drawer__header">
          <div class="filter-drawer__heading">
            <h2 id={titleId} class="filter-drawer__title">
              {title}
            </h2>
            {/* "*" is the browse-mode sentinel — don't echo it as a query. */}
            {params.q !== "" && params.q !== "*" && (
              <p class="filter-drawer__subtitle">Searching for “{params.q}”</p>
            )}
          </div>
          <button
            type="button"
            class="filter-actions__btn filter-actions__btn--reset"
            onClick={onCancel}
          >
            Cancel
          </button>
        </header>

        <div class="filter-drawer__body">
          <FilterCardList
            draft={draft}
            countNoun={countNoun}
            showCountryFacetFilter={showCountryFacetFilter}
          />
        </div>

        <FilterActions
          onReset={draft.reset}
          onApply={handleApply}
          applyDisabled={!draft.canApply}
        />
      </aside>
    </div>
  );
}
