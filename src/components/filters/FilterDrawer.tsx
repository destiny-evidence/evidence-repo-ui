import { Drawer } from "@/components/common/Drawer";
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
  // Show the facet-backed country card; off where the `countries` facet is empty.
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

  function handleApply() {
    const applied = draft.buildApplied();
    if (applied) onApply(applied);
  }

  return (
    <Drawer
      open
      block="filter-drawer"
      title={title}
      // "*" is the browse-mode sentinel — don't echo it as a query.
      subtitle={
        params.q !== "" && params.q !== "*" ? (
          <p class="drawer__subtitle filter-drawer__subtitle">
            Searching for “{params.q}”
          </p>
        ) : undefined
      }
      headerAction={
        <button
          type="button"
          class="filter-actions__btn filter-actions__btn--reset"
          onClick={onCancel}
        >
          Cancel
        </button>
      }
      footer={
        <FilterActions
          onReset={draft.reset}
          onApply={handleApply}
          applyDisabled={!draft.canApply}
        />
      }
      onClose={onCancel}
    >
      <FilterCardList
        draft={draft}
        countNoun={countNoun}
        showCountryFacetFilter={showCountryFacetFilter}
      />
    </Drawer>
  );
}
